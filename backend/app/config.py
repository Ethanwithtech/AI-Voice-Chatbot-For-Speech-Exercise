import os
from dotenv import load_dotenv

load_dotenv()


class Settings:
    # STT Engine: "elevenlabs" or "whisper_local"
    # If ELEVENLABS_API_KEY is not set, automatically falls back to whisper_local
    STT_ENGINE: str = os.getenv("STT_ENGINE", "auto")

    # ElevenLabs STT
    ELEVENLABS_API_KEY: str = os.getenv("ELEVENLABS_API_KEY", "")

    # Poe API (for LLM)
    POE_API_KEY: str = os.getenv("POE_API_KEY", "")
    POE_BOT_NAME: str = os.getenv("POE_BOT_NAME", "GPT-5")

    # JWT
    JWT_SECRET: str = os.getenv("JWT_SECRET", "change-this-secret-key-in-production")
    JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
    JWT_EXPIRE_MINUTES: int = int(os.getenv("JWT_EXPIRE_MINUTES", "1440"))

    # Admin
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "simonwang@hkbu.edu.hk")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123456")

    # Upload
    UPLOAD_DIR: str = os.getenv("UPLOAD_DIR", "uploads")

    # Database - Replit provides DATABASE_URL as PostgreSQL connection string
    # Falls back to SQLite for local development
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./data/app.db")


settings = Settings()
