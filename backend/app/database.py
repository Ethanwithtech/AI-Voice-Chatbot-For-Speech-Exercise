import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, Text, DateTime, ForeignKey, LargeBinary, BigInteger
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
    # PostgreSQL — connect_timeout prevents startup hanging if DB is slow
    engine = create_engine(
        db_url,
        echo=False,
        pool_pre_ping=True,
        pool_timeout=10,
        pool_recycle=1800,
        connect_args={"connect_timeout": 10},
    )

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
    argument_text = Column(Text, nullable=True)
    argument_audio_data = Column(LargeBinary, nullable=True)
    argument_audio_type = Column(String(100), nullable=True)
    topic_context = Column(Text, nullable=True)
    key_claim = Column(Text, nullable=True)
    preparation_time = Column(Integer, nullable=True, default=120)
    response_time = Column(Integer, nullable=True, default=120)
    video_url = Column(String(500), nullable=True)

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
    """Create all tables and auto-migrate missing columns on existing tables."""
    import logging
    logger = logging.getLogger(__name__)

    # Create any missing tables
    Base.metadata.create_all(bind=engine)

    if is_sqlite:
        return

    # Auto-migrate: add missing columns for PostgreSQL
    _run_migrations(logger)


def _run_migrations(logger):
    """Add any missing columns to existing PostgreSQL tables."""
    from sqlalchemy import inspect, text

    inspector = inspect(engine)
    existing_tables = inspector.get_table_names()

    migrations = []

    # practice_sessions migrations
    if "practice_sessions" in existing_tables:
        ps_cols = {col["name"] for col in inspector.get_columns("practice_sessions")}
        if "audio_data" not in ps_cols:
            migrations.append("ALTER TABLE practice_sessions ADD COLUMN audio_data BYTEA")
        if "audio_content_type" not in ps_cols:
            migrations.append("ALTER TABLE practice_sessions ADD COLUMN audio_content_type VARCHAR(100) DEFAULT 'audio/webm'")

    # exercises migrations — CRAA columns
    if "exercises" in existing_tables:
        ex_cols = {col["name"] for col in inspector.get_columns("exercises")}
        if "argument_text" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN argument_text TEXT")
        if "argument_audio_data" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN argument_audio_data BYTEA")
        if "argument_audio_type" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN argument_audio_type VARCHAR(100)")
        if "topic_context" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN topic_context TEXT")
        if "key_claim" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN key_claim TEXT")
        if "preparation_time" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN preparation_time INTEGER DEFAULT 120")
        if "response_time" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN response_time INTEGER DEFAULT 120")
        if "video_url" not in ex_cols:
            migrations.append("ALTER TABLE exercises ADD COLUMN video_url VARCHAR(500)")

    if not migrations:
        logger.info("[migration] All schemas are up to date")
        return

    with engine.connect() as conn:
        for stmt in migrations:
            try:
                conn.execute(text(stmt))
                conn.commit()
                logger.info(f"[migration] Applied: {stmt}")
            except Exception as e:
                logger.warning(f"[migration] Skipped (possibly already exists): {e}")


def get_db():
    """Get a database session."""
    db = SessionLocal()
    try:
        return db
    except Exception:
        db.close()
        raise
