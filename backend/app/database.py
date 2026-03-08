import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, LargeBinary
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
from app.config import settings

db_url = settings.DATABASE_URL

# Replit PostgreSQL URLs may start with "postgres://" which SQLAlchemy 2.x doesn't accept
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

is_sqlite = db_url.startswith("sqlite")

if is_sqlite:
    # Ensure data directory exists for SQLite
    db_path = db_url.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    engine = create_engine(db_url, connect_args={"check_same_thread": False}, echo=False)
else:
    # PostgreSQL (Replit)
    engine = create_engine(db_url, echo=False, pool_pre_ping=True)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), unique=True, nullable=True)
    password_hash = Column(String(255), nullable=True)
    role = Column(String(20), nullable=False, default="student")
    student_code = Column(String(20), unique=True, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    exercises = relationship("Exercise", back_populates="teacher", cascade="all, delete-orphan")
    practice_sessions = relationship("PracticeSession", back_populates="student", cascade="all, delete-orphan")


class Exercise(Base):
    __tablename__ = "exercises"

    id = Column(Integer, primary_key=True, autoincrement=True)
    teacher_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=False)
    reference_text = Column(Text, nullable=True)
    difficulty = Column(String(20), nullable=False, default="medium")
    exercise_type = Column(String(20), nullable=False, default="free_speech")
    created_at = Column(DateTime, default=datetime.utcnow)

    teacher = relationship("User", back_populates="exercises")
    practice_sessions = relationship("PracticeSession", back_populates="exercise")


class PracticeSession(Base):
    __tablename__ = "practice_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    student_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    exercise_id = Column(Integer, ForeignKey("exercises.id", ondelete="SET NULL"), nullable=True)
    audio_url = Column(Text, nullable=True)
    audio_data = Column(LargeBinary, nullable=True)
    audio_content_type = Column(String(100), nullable=True, default="audio/webm")
    transcript = Column(Text, nullable=True)
    duration_seconds = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    student = relationship("User", back_populates="practice_sessions")
    exercise = relationship("Exercise", back_populates="practice_sessions")
    results = relationship("PracticeResult", back_populates="session", cascade="all, delete-orphan")


class PracticeResult(Base):
    __tablename__ = "practice_results"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("practice_sessions.id", ondelete="CASCADE"), nullable=False)
    overall_score = Column(Float, nullable=True)
    grammar_score = Column(Float, nullable=True)
    fluency_score = Column(Float, nullable=True)
    pronunciation_score = Column(Float, nullable=True)
    prosody_score = Column(Float, nullable=True)
    speech_rate = Column(Float, nullable=True)
    pause_count = Column(Integer, nullable=True)
    mean_pause_duration = Column(Float, nullable=True)
    f0_mean = Column(Float, nullable=True)
    f0_std = Column(Float, nullable=True)
    intonation_index = Column(Float, nullable=True)
    is_read_aloud = Column(Boolean, nullable=True)
    llm_feedback = Column(Text, nullable=True)
    errors = Column(Text, nullable=True)
    suggestions = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("PracticeSession", back_populates="results")


class TokenUsage(Base):
    __tablename__ = "token_usage"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_id = Column(Integer, ForeignKey("practice_sessions.id", ondelete="SET NULL"), nullable=True)
    service = Column(String(50), nullable=False)  # "poe_llm", "whisper_local", "elevenlabs"
    tokens_used = Column(Integer, nullable=True)
    estimated_cost = Column(Float, nullable=True, default=0.0)
    detail = Column(Text, nullable=True)  # JSON string with extra info
    created_at = Column(DateTime, default=datetime.utcnow)

    user = relationship("User")


def init_db():
    """Create all tables."""
    Base.metadata.create_all(bind=engine)


def get_db():
    """Get a database session."""
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise
