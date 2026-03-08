from fastapi import APIRouter, HTTPException, status, Depends
import bcrypt
from app.database import get_db, User
from app.auth import create_access_token, get_current_user, require_admin, user_to_dict
from app.models.user import (
    StudentLoginInput, TeacherLoginInput, TeacherRegisterInput,
    UserResponse, LoginResponse
)

router = APIRouter()


@router.post("/student-login", response_model=LoginResponse)
async def student_login(data: StudentLoginInput):
    db = get_db()
    try:
        code = data.student_code.upper()
        user = db.query(User).filter(User.student_code == code, User.role == "student").first()

        if not user:
            user = User(name=code, student_code=code, role="student")
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return LoginResponse(
            token=token,
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role,
                student_code=user.student_code,
                created_at=user.created_at.isoformat() if user.created_at else None,
            )
        )
    finally:
        db.close()


@router.post("/teacher-login", response_model=LoginResponse)
async def teacher_login(data: TeacherLoginInput):
    db = get_db()
    try:
        user = db.query(User).filter(User.email.ilike(data.email)).first()

        if not user:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if user.role not in ("teacher", "admin"):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not user.password_hash:
            raise HTTPException(status_code=401, detail="Invalid email or password")

        if not bcrypt.checkpw(data.password.encode("utf-8"), user.password_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return LoginResponse(
            token=token,
            user=UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role,
                student_code=user.student_code,
                created_at=user.created_at.isoformat() if user.created_at else None,
            )
        )
    finally:
        db.close()


@router.post("/register", response_model=UserResponse)
async def register_teacher(data: TeacherRegisterInput, admin: dict = Depends(require_admin)):
    db = get_db()
    try:
        existing = db.query(User).filter(User.email.ilike(data.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="Email already registered")

        hashed = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        user = User(
            name=data.name,
            email=data.email,
            password_hash=hashed,
            role="teacher",
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return UserResponse(
            id=user.id,
            name=user.name,
            email=user.email,
            role=user.role,
            created_at=user.created_at.isoformat() if user.created_at else None,
        )
    finally:
        db.close()


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        name=current_user["name"],
        email=current_user.get("email"),
        role=current_user["role"],
        student_code=current_user.get("student_code"),
        created_at=current_user.get("created_at"),
    )
