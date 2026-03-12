"""
Initialize the admin user in the database.
Admin is now auto-created on app startup - this script is for manual use only.

Usage: python init_admin.py
"""
import bcrypt
from app.config import settings
from app.database import init_db, get_db, User


def init_admin():
    init_db()
    db = get_db()
    try:
        existing = db.query(User).filter(User.email.ilike(settings.ADMIN_EMAIL)).first()

        
        hashed = bcrypt.hashpw(
            settings.ADMIN_PASSWORD.encode("utf-8"),
            bcrypt.gensalt()
        ).decode("utf-8")

        if existing:
            existing.password_hash = hashed
            existing.role = "admin"
            db.commit()
            print(f"Updated admin user: {settings.ADMIN_EMAIL}")
        else:
            admin = User(
                name="Simon Wang",
                email=settings.ADMIN_EMAIL,
                password_hash=hashed,
                role="admin",
            )
            db.add(admin)
            db.commit()
            print(f"Created admin user: {settings.ADMIN_EMAIL}")
    finally:
        db.close()


if __name__ == "__main__":
    init_admin()
