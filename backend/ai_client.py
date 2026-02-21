import httpx
import asyncio
import json
from typing import Dict, Any, Optional
from config import get_settings
import logging

logger = logging.getLogger(__name__)
settings = get_settings()


class AIClient:
    """
    Multi-provider AI Client with fallback support.
    Primary: Hugging Face Inference API (Free)
    Fallback: AI/ML API
    """
    
    def __init__(self):
        # Hugging Face config
        self.hf_token = settings.HF_API_TOKEN
        self.hf_model = settings.HF_MODEL
        self.hf_api_url = settings.HF_API_URL
        
        # AI/ML API config (fallback)
        self.aiml_key = settings.AIML_API_KEY
        self.aiml_model = settings.AIML_MODEL
        self.aiml_base_url = settings.AIML_BASE_URL
        
    def _build_prompt(self, transcribed_text: str, cv_text: Optional[str] = None, job_description: Optional[str] = None) -> str:
        """Build the full prompt for the AI model, personalized with CV and job context"""
        
        # Build profile section from CV or fallback to default
        if cv_text:
            profile_section = f"""Perfil del candidato (extraído de su CV):
{cv_text}"""
        else:
            profile_section = f"""Perfil del candidato:
{settings.ENGINEER_PROFILE}"""
        
        # Build job context if available
        job_section = ""
        if job_description:
            job_section = f"""
Puesto al que postula:
{job_description}

IMPORTANTE: Adapta la respuesta sugerida para que sea relevante al puesto descrito.
Destaca las habilidades y experiencias del CV que más se alinean con este puesto.
"""
        
        return f"""Eres un asistente de entrevistas técnicas en tiempo real. Tu rol es ayudar a un candidato durante su entrevista en inglés.

{profile_section}
{job_section}
Tu tarea:
1. Si la pregunta está en inglés, tradúcela al español
2. Genera una respuesta técnica sugerida EN INGLÉS basada en el perfil real del candidato
3. La respuesta debe sonar natural y profesional, como si el candidato la dijera
4. Identifica términos técnicos clave que el candidato debería mencionar
5. Mantén las respuestas concisas (2-4 oraciones) pero impactantes

IMPORTANTE: Responde SOLO con un JSON válido, sin texto adicional. Formato:
{{"original_text": "pregunta original", "translation": "traducción al español", "suggested_answer": "respuesta técnica sugerida en inglés", "key_technical_terms": ["término1", "término2"]}}

Pregunta del entrevistador: "{transcribed_text}"
"""

    async def process_interview_question(self, transcribed_text: str, cv_text: Optional[str] = None, job_description: Optional[str] = None) -> Dict[str, Any]:
        """
        Process transcribed interview question using available AI providers.
        Tries Hugging Face first, falls back to AI/ML API.
        """
        # Try Hugging Face first
        logger.info("🤗 Intentando con Hugging Face...")
        result = await self._call_huggingface(transcribed_text, cv_text, job_description)
        if result:
            return result
        
        # Fallback to AI/ML API
        logger.info("🔄 Fallback a AI/ML API...")
        result = await self._call_aiml_api(transcribed_text, cv_text, job_description)
        if result:
            return result
        
        # All providers failed
        logger.error("❌ Todos los proveedores fallaron")
        return {
            "original_text": transcribed_text,
            "translation": "Error: No se pudo conectar con ningún proveedor de IA",
            "suggested_answer": "All AI providers failed. Please check your connection.",
            "key_technical_terms": [],
            "error": "All providers failed"
        }
    
    async def _call_huggingface(self, transcribed_text: str, cv_text: Optional[str] = None, job_description: Optional[str] = None) -> Dict[str, Any] | None:
        """Call Hugging Face Inference API with retry logic"""
        max_retries = 3
        retry_delay = 2
        prompt = self._build_prompt(transcribed_text, cv_text, job_description)
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=60.0) as client:
                    url = f"{self.hf_api_url}/chat/completions"
                    
                    response = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {self.hf_token}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.hf_model,
                            "messages": [
                                {
                                    "role": "user",
                                    "content": prompt
                                }
                            ],
                            "temperature": 0.7,
                            "max_tokens": 500,
                            "stream": False
                        }
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        ai_text = result["choices"][0]["message"]["content"]
                        logger.info(f"✅ HF: Respuesta exitosa en intento {attempt + 1}")
                        return self._parse_ai_response(ai_text, transcribed_text)
                    
                    elif response.status_code in [429, 503, 500]:
                        if attempt < max_retries - 1:
                            logger.warning(f"⚠️ HF: Error {response.status_code}, reintentando en {retry_delay}s...")
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2
                            continue
                        else:
                            logger.error(f"❌ HF: Error {response.status_code} después de {max_retries} intentos")
                            return None
                    else:
                        logger.error(f"❌ HF: Error {response.status_code}: {response.text[:200]}")
                        return None
                        
            except Exception as e:
                logger.error(f"❌ HF: Error en intento {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return None
        
        return None
    
    async def _call_aiml_api(self, transcribed_text: str, cv_text: Optional[str] = None, job_description: Optional[str] = None) -> Dict[str, Any] | None:
        """Call AI/ML API as fallback with retry logic"""
        max_retries = 3
        retry_delay = 1
        prompt = self._build_prompt(transcribed_text, cv_text, job_description)
        
        for attempt in range(max_retries):
            try:
                async with httpx.AsyncClient(timeout=30.0) as client:
                    response = await client.post(
                        f"{self.aiml_base_url}/chat/completions",
                        headers={
                            "Authorization": f"Bearer {self.aiml_key}",
                            "Content-Type": "application/json"
                        },
                        json={
                            "model": self.aiml_model,
                            "messages": [
                                {
                                    "role": "user",
                                    "content": prompt
                                }
                            ],
                            "temperature": 0.7,
                            "max_tokens": 500
                        }
                    )
                    
                    if response.status_code == 200:
                        result = response.json()
                        ai_text = result["choices"][0]["message"]["content"]
                        logger.info(f"✅ AIML: Respuesta exitosa en intento {attempt + 1}")
                        return self._parse_ai_response(ai_text, transcribed_text)
                    
                    elif response.status_code in [403, 429]:
                        if attempt < max_retries - 1:
                            logger.warning(f"⚠️ AIML: Error {response.status_code}, reintentando...")
                            await asyncio.sleep(retry_delay)
                            retry_delay *= 2
                            continue
                        else:
                            return None
                    else:
                        logger.error(f"❌ AIML: Error {response.status_code}: {response.text[:200]}")
                        return None
                        
            except Exception as e:
                logger.error(f"❌ AIML: Error en intento {attempt + 1}: {e}")
                if attempt < max_retries - 1:
                    await asyncio.sleep(retry_delay)
                    retry_delay *= 2
                else:
                    return None
        
        return None
    
    def _parse_ai_response(self, ai_text: str, original_text: str) -> Dict[str, Any]:
        """Parse AI response text into structured JSON"""
        try:
            cleaned = ai_text.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            elif cleaned.startswith("```"):
                cleaned = cleaned[3:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            
            parsed = json.loads(cleaned)
            
            return {
                "original_text": parsed.get("original_text", original_text),
                "translation": parsed.get("translation", ""),
                "suggested_answer": parsed.get("suggested_answer", ""),
                "key_technical_terms": parsed.get("key_technical_terms", [])
            }
        except (json.JSONDecodeError, KeyError):
            logger.warning("⚠️ No se pudo parsear JSON, usando texto raw")
            return {
                "original_text": original_text,
                "translation": original_text if not self._is_english(original_text) else "N/A",
                "suggested_answer": ai_text,
                "key_technical_terms": []
            }
    
    def _is_english(self, text: str) -> bool:
        """Simple heuristic to detect if text is in English"""
        english_words = ["the", "is", "are", "what", "how", "why", "can", "you", "your",
                        "tell", "me", "about", "describe", "explain", "have", "experience"]
        text_lower = text.lower()
        matches = sum(1 for word in english_words if f" {word} " in f" {text_lower} ")
        return matches >= 2


# Singleton instance
ai_client = AIClient()
