import os
import logging
import threading
import bcrypt
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response

print("[BOOT] Starting AI Speech Coach server...", flush=True)
logging.basicConfig(level=logging.INFO)

from app.config import settings
from app.database import init_db, get_db, User, Exercise
from app.routers import auth_router, exercise_router, practice_router, user_router

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="AI Speech Coach API",
    description="AI-powered speech practice and assessment platform",
    version="1.0.0",
)
print("[BOOT] FastAPI app created, binding to port 5000...", flush=True)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)


@app.get("/api/health")
async def health_check():
    stt_engine = "elevenlabs" if settings.ELEVENLABS_API_KEY else "whisper_local"
    if settings.STT_ENGINE != "auto":
        stt_engine = settings.STT_ENGINE
    return {
        "status": "ok",
        "message": "AI Speech Coach API is running",
        "stt_engine": stt_engine,
    }



app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(exercise_router.router, prefix="/api/exercises", tags=["Exercises"])
app.include_router(practice_router.router, prefix="/api/practice", tags=["Practice"])
app.include_router(user_router.router, prefix="/api/users", tags=["Users"])

# Serve frontend - mount static assets separately, handle SPA routing manually
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    # Serve static assets (JS, CSS, images) from /assets
    assets_dir = os.path.join(frontend_dist, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # SPA catch-all: serve index.html for all non-API, non-asset routes
    @app.get("/{full_path:path}")
    async def serve_frontend(request: Request, full_path: str):
        # Don't serve frontend for API routes
        if full_path.startswith("api/"):
            return {"detail": "Not found"}
        # Try to serve the exact file first
        file_path = os.path.join(frontend_dist, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        # Serve index.html for SPA routing — always no-cache so browsers
        # pick up the latest content-hashed JS/CSS bundle after rebuilds
        index_path = os.path.join(frontend_dist, "index.html")
        with open(index_path, "rb") as f:
            content = f.read()
        return Response(
            content=content,
            media_type="text/html",
            headers={
                "Cache-Control": "no-cache, no-store, must-revalidate",
                "Pragma": "no-cache",
                "Expires": "0",
            },
        )


@app.on_event("startup")
def startup():
    """Start server immediately, run DB init in background thread."""
    thread = threading.Thread(target=_startup_background, daemon=True)
    thread.start()


def _startup_background():
    """Run DB migrations, admin setup, and exercise seeding in background."""
    logger = logging.getLogger(__name__)
    try:
        logger.info("[startup] Running DB init in background...")
        init_db()
        logger.info("[startup] DB init complete")
    except Exception as e:
        logger.error(f"[startup] DB init failed: {e}")

    try:
        _ensure_admin()
    except Exception as e:
        logger.error(f"[startup] Admin setup failed (non-fatal): {e}")

    try:
        _seed_exercises()
    except Exception as e:
        logger.error(f"[startup] Exercise seeding failed (non-fatal): {e}")


def _ensure_admin():
    """Create default admin user if not exists."""
    logger = logging.getLogger(__name__)
    db = get_db()
    try:
        admin = db.query(User).filter(User.email.ilike(settings.ADMIN_EMAIL)).first()
        hashed = bcrypt.hashpw(
            settings.ADMIN_PASSWORD.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        if admin:
            admin.password_hash = hashed
            admin.role = "admin"
            db.commit()
            logger.info(f"[startup] Admin user updated: {settings.ADMIN_EMAIL}")
        else:
            admin = User(
                name="Simon Wang",
                email=settings.ADMIN_EMAIL,
                password_hash=hashed,
                role="admin",
            )
            db.add(admin)
            db.commit()
            logger.info(f"[startup] Admin user created: {settings.ADMIN_EMAIL}")
    except Exception as e:
        logger.error(f"[startup] Failed to ensure admin user: {e}")
        raise
    finally:
        db.close()


def _seed_exercises():
    """Seed default CRAA exercises if the exercises table is empty."""
    logger = logging.getLogger(__name__)
    db = get_db()
    try:
        craa_count = db.query(Exercise).filter(Exercise.exercise_type == "craa").count()
        if craa_count > 0:
            logger.info(f"[startup] {craa_count} CRAA exercise(s) already exist, skipping seed")
            return

        import sys as _sys
        _sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__))))
        from seed_craa import CRAA_EXERCISES

        admin = db.query(User).filter(User.role.in_(["admin", "teacher"])).first()
        if not admin:
            logger.warning("[startup] No admin/teacher found, cannot seed exercises")
            return

        for data in CRAA_EXERCISES:
            ex = Exercise(
                teacher_id=admin.id,
                title=data["title"],
                description=data["description"],
                difficulty=data["difficulty"],
                exercise_type="craa",
                topic_context=data["topic_context"],
                key_claim=data["key_claim"],
                argument_text=data["argument_text"],
                preparation_time=data["preparation_time"],
                response_time=data["response_time"],
                video_url=data.get("video_url"),
            )
            db.add(ex)

        db.commit()
        logger.info(f"[startup] Seeded {len(CRAA_EXERCISES)} CRAA exercises")
    finally:
        db.close()
