import os
import bcrypt
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
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
)

app.include_router(auth_router.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(exercise_router.router, prefix="/api/exercises", tags=["Exercises"])
app.include_router(practice_router.router, prefix="/api/practice", tags=["Practice"])
app.include_router(user_router.router, prefix="/api/users", tags=["Users"])

# Serve frontend static files if available
frontend_dist = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")


@app.on_event("startup")
def startup():
    init_db()
    _ensure_admin()


def _ensure_admin():
    """Create default admin user if not exists."""
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
        else:
            admin = User(
                name="Simon Wang",
                email=settings.ADMIN_EMAIL,
                password_hash=hashed,
                role="admin",
            )
            db.add(admin)
            db.commit()
    finally:
        db.close()


@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "AI Speech Coach API is running"}
