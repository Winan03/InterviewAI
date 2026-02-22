from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
import logging
import asyncio
import base64
from typing import Dict, Any, Optional, List
import json
import sys

# Fix for async DB drivers on Windows (require SelectorEventLoop, not ProactorEventLoop)
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from config import get_settings
from transcription import transcriber
from ai_client import ai_client
from pdf_parser import extract_text_from_pdf, extract_text_from_multiple_pdfs
from database import init_db
from auth import router as auth_router, decode_token
from payments import router as payments_router
from solver import router as solver_router

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="VozInterview API",
    description="Real-time interview assistant with AI-powered suggestions",
    version="1.0.0"
)

settings = get_settings()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(payments_router)
app.include_router(solver_router)

# Serve landing page static files
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import os

# Resolve landing directory (use forward slashes for Windows compatibility)
_landing_dir = Path(__file__).resolve().parent.parent / "landing"
if not _landing_dir.exists():
    _landing_dir = Path("d:/Trabajo/VozInterview/landing")

_landing_path = str(_landing_dir).replace("\\", "/")
logger.info(f"Landing dir exists: {_landing_dir.exists()}, path: {_landing_path}")
logger.info(f"Landing files: {list(_landing_dir.iterdir()) if _landing_dir.exists() else 'N/A'}")

if _landing_dir.exists():
    app.mount("/landing", StaticFiles(directory=_landing_path, html=True), name="landing")
    logger.info("✅ Static files mounted at /landing")


@app.on_event("startup")
async def startup_event():
    """Initialize database tables on startup."""
    await init_db()
    logger.info("Database initialized")


class ConnectionManager:
    """Manages WebSocket connections with per-session context"""
    
    def __init__(self):
        self.active_connections: list[WebSocket] = []
        # Store CV text and job description per connection
        self.session_context: Dict[WebSocket, Dict[str, str]] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.session_context[websocket] = {"cv_text": None, "job_description": None}
        logger.info(f"Client connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        if websocket in self.session_context:
            del self.session_context[websocket]
        logger.info(f"Client disconnected. Total connections: {len(self.active_connections)}")
    
    async def send_message(self, message: Dict[str, Any], websocket: WebSocket):
        await websocket.send_json(message)
    
    def set_context(self, websocket: WebSocket, cv_text: str = None, job_description: str = None):
        """Set CV and job context for a WebSocket session"""
        if websocket in self.session_context:
            if cv_text is not None:
                self.session_context[websocket]["cv_text"] = cv_text
            if job_description is not None:
                self.session_context[websocket]["job_description"] = job_description
    
    def get_context(self, websocket: WebSocket) -> Dict[str, str]:
        """Get CV and job context for a WebSocket session"""
        return self.session_context.get(websocket, {"cv_text": None, "job_description": None})


manager = ConnectionManager()

# Global session context storage for REST → WebSocket bridge
# Key: session_id (from frontend), Value: {cv_text, job_description}
session_contexts: Dict[str, Dict[str, str]] = {}


@app.get("/")
async def root():
    """Redirect to landing page"""
    return RedirectResponse(url="/landing/")


@app.get("/health")
async def health_check():
    """Detailed health check"""
    return {
        "status": "healthy",
        "active_connections": len(manager.active_connections),
        "ai_model": settings.HF_MODEL
    }


# ─── CV UPLOAD ENDPOINT ───

@app.post("/api/upload-context")
async def upload_context(
    files: List[UploadFile] = File(default=[]),
    job_description: str = Form(default=""),
    session_id: str = Form(default="default")
):
    """
    Upload CV PDFs and job description to personalize AI responses.
    
    - files: One or more PDF files (CV, projects, portfolio)
    - job_description: Text description of the job posting
    - session_id: Client session identifier
    """
    try:
        cv_text = None
        
        # Process uploaded PDFs
        if files:
            pdf_data = []
            for file in files:
                if file.filename and file.size > 0:
                    content = await file.read()
                    pdf_data.append((file.filename, content))
                    logger.info(f"📄 Received file: {file.filename} ({len(content)} bytes)")
            
            if pdf_data:
                cv_text = extract_text_from_multiple_pdfs(pdf_data)
                if cv_text:
                    logger.info(f"✅ Extracted {len(cv_text)} chars from {len(pdf_data)} files")
                else:
                    logger.warning("⚠️ Could not extract text from uploaded PDFs")
        
        # Store context for this session
        session_contexts[session_id] = {
            "cv_text": cv_text,
            "job_description": job_description if job_description else None
        }
        
        logger.info(f"📋 Session context saved: session={session_id}, cv={'Yes' if cv_text else 'No'}, job={'Yes' if job_description else 'No'}")
        
        return {
            "status": "ok",
            "cv_extracted": bool(cv_text),
            "cv_length": len(cv_text) if cv_text else 0,
            "job_description_set": bool(job_description),
            "files_processed": len([f for f in files if f.filename and f.size > 0]) if files else 0,
            "session_id": session_id
        }
        
    except Exception as e:
        logger.error(f"❌ Error uploading context: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ─── WEBSOCKET ENDPOINT ───

@app.websocket("/ws/audio")
async def websocket_audio_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time audio streaming and processing.
    
    Supports messages:
    - type: "audio" → transcribe and process with AI
    - type: "text" → process with AI directly
    - type: "set_context" → set CV/job context for this session
    - type: "ping" → heartbeat
    
    Optionally validates JWT token from query param: /ws/audio?token=<jwt>
    """
    # Optional JWT validation (if token is present)
    token = websocket.query_params.get("token")
    if token:
        payload = decode_token(token)
        if not payload:
            await websocket.close(code=4001, reason="Token inválido")
            return
        logger.info(f"Authenticated WebSocket: {payload.get('email')}")
    
    await manager.connect(websocket)
    
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            
            if message_type == "audio":
                await process_audio_message(websocket, message)
                
            elif message_type == "text":
                await process_text_message(websocket, message)
            
            elif message_type == "set_context":
                # Set session context from WebSocket message
                session_id = message.get("session_id", "default")
                ctx = session_contexts.get(session_id, {})
                manager.set_context(
                    websocket,
                    cv_text=ctx.get("cv_text"),
                    job_description=ctx.get("job_description")
                )
                await manager.send_message({
                    "type": "status",
                    "message": "✅ Contexto de entrevista configurado"
                }, websocket)
                logger.info(f"📋 WebSocket context set from session: {session_id}")
                
            elif message_type == "ping":
                await manager.send_message({"type": "pong"}, websocket)
                
            else:
                await manager.send_message({
                    "type": "error",
                    "message": f"Unknown message type: {message_type}"
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        logger.info("Client disconnected")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(websocket)


async def process_audio_message(websocket: WebSocket, message: Dict[str, Any]):
    """Process audio data from WebSocket message"""
    try:
        await manager.send_message({
            "type": "status",
            "message": "Transcribiendo audio..."
        }, websocket)
        
        audio_data_base64 = message.get("data")
        audio_format = message.get("format", "webm")
        
        audio_bytes = base64.b64decode(audio_data_base64)
        
        transcribed_text = await transcriber.transcribe_audio(audio_bytes, audio_format)
        
        if not transcribed_text:
            await manager.send_message({
                "type": "error",
                "message": "No se pudo transcribir el audio. Intenta hablar más claro."
            }, websocket)
            return
        
        await manager.send_message({
            "type": "transcription",
            "text": transcribed_text
        }, websocket)
        
        await process_with_ai(websocket, transcribed_text)
        
    except Exception as e:
        logger.error(f"Error processing audio: {e}")
        await manager.send_message({
            "type": "error",
            "message": f"Error procesando audio: {str(e)}"
        }, websocket)


async def process_text_message(websocket: WebSocket, message: Dict[str, Any]):
    """Process text message directly"""
    try:
        text = message.get("data")
        
        if not text:
            await manager.send_message({
                "type": "error",
                "message": "No text provided"
            }, websocket)
            return
        
        await process_with_ai(websocket, text)
        
    except Exception as e:
        logger.error(f"Error processing text: {e}")
        await manager.send_message({
            "type": "error",
            "message": f"Error procesando texto: {str(e)}"
        }, websocket)


async def process_with_ai(websocket: WebSocket, text: str):
    """Process transcribed text with AI and send response, using session context"""
    try:
        await manager.send_message({
            "type": "status",
            "message": "Generando respuesta con IA..."
        }, websocket)
        
        # Get session context (CV + job description)
        ctx = manager.get_context(websocket)
        
        # Get AI response with personalized context
        ai_response = await ai_client.process_interview_question(
            text,
            cv_text=ctx.get("cv_text"),
            job_description=ctx.get("job_description")
        )
        
        await manager.send_message({
            "type": "ai_response",
            "data": ai_response
        }, websocket)
        
    except Exception as e:
        logger.error(f"Error processing with AI: {e}")
        await manager.send_message({
            "type": "error",
            "message": f"Error generando respuesta: {str(e)}"
        }, websocket)


@app.post("/api/transcribe")
async def transcribe_endpoint(audio_file: bytes):
    """REST endpoint for audio transcription"""
    try:
        text = await transcriber.transcribe_audio(audio_file)
        if not text:
            raise HTTPException(status_code=400, detail="Could not transcribe audio")
        return {"transcription": text}
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/process")
async def process_question(question: Dict[str, str]):
    """REST endpoint to process interview question with AI"""
    try:
        text = question.get("text")
        if not text:
            raise HTTPException(status_code=400, detail="No text provided")
        response = await ai_client.process_interview_question(text)
        return response
    except Exception as e:
        logger.error(f"Processing error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.BACKEND_HOST,
        port=settings.BACKEND_PORT,
        reload=True,
        log_level="info"
    )
