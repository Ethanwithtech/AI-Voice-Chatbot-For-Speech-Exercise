import os
import logging
import threading
import bcrypt
from fastapi import FastAPI, Request

logging.basicConfig(level=logging.INFO)
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, Response
from app.config import settings
from app.database import init_db, get_db, User
from app.routers import auth_router, exercise_router, practice_router, user_router

os.makedirs(settings.UPLOAD_DIR, exist_ok=True)

app = FastAPI(
    title="AI Speech Coach API",
    description="AI-powered speech practice and assessment platform",
    version="1.0.0",
)

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


@app.get("/api/debug-headers")
async def debug_headers(request: Request):
    return {
        "headers": dict(request.headers),
        "url": str(request.url),
        "client": request.client.host if request.client else None,
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
    """Run DB migrations and admin setup in background so port binds instantly."""
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
