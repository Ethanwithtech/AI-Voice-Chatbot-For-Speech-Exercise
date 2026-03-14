from datetime import datetime, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from app.config import settings
from app.database import get_db, User

security = HTTPBearer()


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=settings.JWT_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])


def user_to_dict(user: User) -> dict:
    """Convert SQLAlchemy User object to dict."""
    return {
        "id": user.id,
        "name": user.name,
        "email": user.email,
        "password_hash": user.password_hash,
        "role": user.role,
        "student_code": user.student_code,
        "section": user.section,
        "is_approved": user.is_approved,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or expired token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = decode_token(token)
        user_id = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    db = get_db()
    try:
        user = db.query(User).filter(User.id == int(user_id)).first()
        if not user:
            raise credentials_exception
        return user_to_dict(user)
    finally:
        db.close()


async def require_teacher(current_user: dict = Depends(get_current_user)):
    if current_user["role"] not in ("teacher", "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Teacher or admin access required"
        )
    return current_user


async def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user["role"] != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return current_user
