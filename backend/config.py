from pydantic_settings import BaseSettings
from functools import lru_cache
from pathlib import Path

# Find .env file: check CWD first, then project root (one level up)
_env_file = Path(".env")
if not _env_file.exists():
    _env_file = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    """Application configuration settings"""
    
    # Hugging Face Configuration (Primary - Free)
    HF_API_TOKEN: str = ""
    HF_MODEL: str = "google/gemma-3-12b-it:featherless-ai"
    HF_API_URL: str = "https://router.huggingface.co/v1"
    HF_VISION_MODEL: str = "Qwen/Qwen2.5-VL-7B-Instruct"
    
    # AI/ML API Configuration (Fallback)
    AIML_API_KEY: str = ""
    AIML_MODEL: str = "google/gemma-3-12b-it"
    AIML_BASE_URL: str = "https://api.aimlapi.com/v1"
    
    # Backend Configuration
    BACKEND_HOST: str = "localhost"
    BACKEND_PORT: int = 8000
    
    # Audio Configuration
    AUDIO_SAMPLE_RATE: int = 16000
    AUDIO_CHUNK_SIZE: int = 1024
    AUDIO_CHANNELS: int = 1
    
    # CORS Configuration
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:8000",
        "https://voz-interview.onrender.com",
    ]
    
    # Database Configuration
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/vozinterview"
    
    # JWT Configuration
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 1440  # 24 hours
    
    # Stripe Configuration
    STRIPE_SECRET_KEY: str = ""
    STRIPE_PUBLISHABLE_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_PREMIUM_PRICE: int = 1499  # $14.99 in cents
    
    # Engineer Profile for AI Context
    ENGINEER_PROFILE: str = """
    Ingeniero experto en:
    - NLP (Natural Language Processing): Wav2Vec, RoBERTa-Biomedical
    - Backend Development: FastAPI, Python
    - Machine Learning: Modelos de lenguaje, procesamiento de audio
    - Experiencia en sistemas de transcripción y análisis de voz
    """
    
    class Config:
        env_file = str(_env_file)
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()
