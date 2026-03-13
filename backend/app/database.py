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

    # CRAA-specific fields
    argument_text = Column(Text, nullable=True)          # Full transcript of the argument audio
    argument_audio_data = Column(LargeBinary, nullable=True)  # Teacher-uploaded argument audio
    argument_audio_type = Column(String(100), nullable=True)  # MIME type of argument audio
    topic_context = Column(Text, nullable=True)           # Background context for the topic
    key_claim = Column(Text, nullable=True)               # The core claim to be summarised/rebutted
    preparation_time = Column(Integer, nullable=True, default=120)   # Prep time in seconds
    response_time = Column(Integer, nullable=True, default=120)      # Response time in seconds
    video_url = Column(Text, nullable=True)               # Optional background/warm-up video URL (YouTube)

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
    """Create all tables and migrate missing columns."""
    Base.metadata.create_all(bind=engine)
    _run_migrations()


def _run_migrations():
    """Add missing columns/tables for existing PostgreSQL databases."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    if "practice_sessions" in existing_tables:
        columns = [col["name"] for col in inspector.get_columns("practice_sessions")]

        with engine.begin() as conn:
            if "audio_data" not in columns:
                if is_sqlite:
                    conn.execute(text("ALTER TABLE practice_sessions ADD COLUMN audio_data BLOB"))
                else:
                    conn.execute(text("ALTER TABLE practice_sessions ADD COLUMN audio_data BYTEA"))

            if "audio_content_type" not in columns:
                conn.execute(text(
                    "ALTER TABLE practice_sessions ADD COLUMN audio_content_type VARCHAR(100) DEFAULT 'audio/webm'"
                ))

    # Migrate exercises table for CRAA fields
    if "exercises" in existing_tables:
        columns = [col["name"] for col in inspector.get_columns("exercises")]

        craa_columns = {
            "argument_text": "TEXT",
            "argument_audio_type": "VARCHAR(100)",
            "topic_context": "TEXT",
            "key_claim": "TEXT",
            "preparation_time": "INTEGER DEFAULT 120",
            "response_time": "INTEGER DEFAULT 120",
            "video_url": "TEXT",
        }
        # argument_audio_data needs special handling for binary
        with engine.begin() as conn:
            for col_name, col_type in craa_columns.items():
                if col_name not in columns:
                    conn.execute(text(f"ALTER TABLE exercises ADD COLUMN {col_name} {col_type}"))

            if "argument_audio_data" not in columns:
                if is_sqlite:
                    conn.execute(text("ALTER TABLE exercises ADD COLUMN argument_audio_data BLOB"))
                else:
                    conn.execute(text("ALTER TABLE exercises ADD COLUMN argument_audio_data BYTEA"))

    # token_usage table is handled by create_all() if it doesn't exist


def get_db():
    """Get a database session."""
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise
