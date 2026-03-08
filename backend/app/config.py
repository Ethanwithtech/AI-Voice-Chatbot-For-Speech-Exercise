import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # ElevenLabs STT
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")

    # OpenRouter LLM
    OPENROUTER_API_KEY: str = os.getenv("OPENROUTER_API_KEY", "")
    OPENROUTER_BASE_URL: str = os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1")
    LLM_MODEL: str = os.getenv("LLM_MODEL", "openai/gpt-4.1")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-this-secret-key-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

    # Admin
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "simonwang@hkbu.edu.hk")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123456")

    # Upload
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

    # Database (SQLite)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")


settings = Settings()
