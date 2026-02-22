"""
Image Solver endpoint for VozInterview.
Analyzes images of English exercises and returns solutions in EN/ES.
Uses Qwen2.5-VL via Hugging Face Router (free tier).
"""
import base64
import json
import re
import logging
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from config import get_settings
from auth import get_current_user
from models import User

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(prefix="/api/solver", tags=["solver"])


class SolverRequest(BaseModel):
    """Request body for image analysis."""
    image_base64: str  # Base64-encoded image (with or without data URI prefix)
    question: Optional[str] = None  # Optional user question about the exercise


class SolverResponse(BaseModel):
    """Structured response from the solver."""
    answer: str
    explanation_en: str
    explanation_es: str
    exercise_type: str


SOLVER_SYSTEM_PROMPT = """You are an expert English language tutor. When shown an image of an English exercise, you MUST:

1. Identify the exercise type
2. Solve ALL questions in the image
3. Explain each answer in English AND Spanish

CRITICAL: Your response must be ONLY a JSON object. No text before or after it. No markdown. No code blocks.

The JSON must have exactly these 4 keys:

{"answer": "Write each answer on its own numbered line, e.g.:\n1. answer one\n2. answer two", "explanation_en": "English explanation of WHY each answer is correct. Use numbered lines matching the answers. Include grammar rules.", "explanation_es": "Explicación en español de POR QUÉ cada respuesta es correcta. Usa líneas numeradas. Incluye reglas gramaticales.", "exercise_type": "fill-in-the-blank"}

Valid exercise_type values: fill-in-the-blank, multiple-choice, matching, grammar, vocabulary, reading, writing, other

IMPORTANT: 
- The answer field should list answers clearly numbered
- Both explanation fields should reference grammar rules and give clear reasoning
- Write explanations in plain text paragraphs, NOT as JSON
- NEVER wrap your response in code blocks"""


def _clean_base64(image_base64: str) -> str:
    """Strip data URI prefix if present, return raw base64."""
    if "," in image_base64:
        return image_base64.split(",", 1)[1]
    return image_base64


def _detect_mime(image_base64: str) -> str:
    """Detect MIME type from data URI or default to image/png."""
    if image_base64.startswith("data:"):
        mime = image_base64.split(";")[0].split(":")[1]
        return mime
    return "image/png"


def _extract_json(text: str) -> dict:
    """
    Robustly extract a JSON object from model response text.
    Handles: raw JSON, markdown code blocks, JSON embedded in text.
    """
    text = text.strip()
    
    # 1. Try parsing the raw text directly
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    
    # 2. Try extracting from markdown code blocks: ```json ... ``` or ``` ... ```
    code_block_match = re.search(r'```(?:json)?\s*\n?(.*?)\n?```', text, re.DOTALL)
    if code_block_match:
        try:
            return json.loads(code_block_match.group(1).strip())
        except json.JSONDecodeError:
            pass
    
    # 3. Try finding JSON object anywhere in the text { ... }
    # Find the first { and the last }
    first_brace = text.find('{')
    last_brace = text.rfind('}')
    if first_brace != -1 and last_brace > first_brace:
        json_candidate = text[first_brace:last_brace + 1]
        try:
            return json.loads(json_candidate)
        except json.JSONDecodeError:
            pass
    
    # 4. Nothing worked
    raise ValueError("No valid JSON found in response")


@router.post("/analyze", response_model=SolverResponse)
async def analyze_image(
    req: SolverRequest,
    user: User = Depends(get_current_user),
):
    """Analyze an exercise image and return the solution in EN/ES."""
    
    mime_type = _detect_mime(req.image_base64)
    raw_b64 = _clean_base64(req.image_base64)
    
    # Build the image URL for the vision model
    image_url = f"data:{mime_type};base64,{raw_b64}"
    
    # Build user message content
    user_content = [
        {
            "type": "image_url",
            "image_url": {"url": image_url},
        },
        {
            "type": "text",
            "text": req.question or "Analyze this English exercise. Identify the exercise type, solve it, and explain the answer in both English and Spanish. Respond ONLY with the JSON object.",
        },
    ]
    
    messages = [
        {"role": "system", "content": SOLVER_SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]
    
    # Call Hugging Face Router (OpenAI-compatible chat completions)
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{settings.HF_API_URL}/chat/completions",
                headers={
                    "Authorization": f"Bearer {settings.HF_API_TOKEN}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.HF_VISION_MODEL,
                    "messages": messages,
                    "max_tokens": 2000,
                    "temperature": 0.2,
                },
            )
            
            if response.status_code != 200:
                logger.error(f"HF Vision API error {response.status_code}: {response.text[:300]}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Error del modelo de visión (HTTP {response.status_code})",
                )
            
            data = response.json()
            content = data["choices"][0]["message"]["content"]
            
            logger.info(f"Solver raw response for {user.email}: {content[:300]}...")
            
    except httpx.TimeoutException:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="El modelo tardó demasiado en responder. Intenta de nuevo.",
        )
    except httpx.HTTPError as e:
        logger.error(f"HTTP error calling vision model: {e}")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="Error de conexión con el modelo de visión.",
        )
    
    # Parse the JSON response from the model
    try:
        parsed = _extract_json(content)
        
        return SolverResponse(
            answer=parsed.get("answer", "No se pudo determinar la respuesta"),
            explanation_en=parsed.get("explanation_en", "No explanation available"),
            explanation_es=parsed.get("explanation_es", "Explicación no disponible"),
            exercise_type=parsed.get("exercise_type", "other"),
        )
        
    except (ValueError, KeyError, TypeError) as e:
        logger.warning(f"Could not parse JSON from model response: {e}")
        logger.warning(f"Raw content: {content[:500]}")
        # Fallback: return the raw text as the answer
        return SolverResponse(
            answer=content,
            explanation_en="The model returned a free-form response (shown above).",
            explanation_es="El modelo devolvió una respuesta libre (mostrada arriba).",
            exercise_type="other",
        )

