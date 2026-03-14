import random
import string
from fastapi import APIRouter, HTTPException, status, Depends
import bcrypt
from app.database import get_db, User
from app.auth import create_access_token, get_current_user, require_admin, require_teacher, user_to_dict
from app.models.user import (
    StudentLoginInput, StudentRegisterInput,
    TeacherLoginInput, TeacherRegisterInput, TeacherAccessRequestInput,
    UserResponse, LoginResponse
)

router = APIRouter()


def _user_response(user) -> UserResponse:
    return UserResponse(
        id=user.id,
        name=user.name,
        email=user.email,
        role=user.role,
        student_code=user.student_code,
        section=getattr(user, "section", None),
        created_at=user.created_at.isoformat() if user.created_at else None,
    )


@router.post("/student-login", response_model=LoginResponse)
async def student_login(data: StudentLoginInput):
    """Login with student unique code (e.g. 6342-YD-A1). Auto-registers if code doesn't exist (backward compat)."""
    db = get_db()
    try:
        code = data.student_code.upper().strip()
        user = db.query(User).filter(User.student_code == code, User.role == "student").first()

        if not user:
            # Backward compatibility: auto-create student if code doesn't exist
            user = User(name=code, student_code=code, role="student", is_approved=True)
            db.add(user)
            db.commit()
            db.refresh(user)

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return LoginResponse(token=token, user=_user_response(user))
    finally:
        db.close()


@router.post("/student-register", response_model=LoginResponse)
async def student_register(data: StudentRegisterInput):
    """
    3-step student registration:
    1. Last 4 digits of student ID
    2. Name initials (e.g. YD)
    3. Section (optional, e.g. A1)

    Generates a unique code like: 6342-YD-A1
    """
    db = get_db()
    try:
        digits = data.last_four_digits.strip()
        initials = data.initials.upper().strip()
        section = (data.section or "").upper().strip()

        if not digits or len(digits) != 4 or not digits.isdigit():
            raise HTTPException(status_code=400, detail="Please enter exactly 4 digits from your student ID")

        if not initials or len(initials) < 1 or len(initials) > 4:
            raise HTTPException(status_code=400, detail="Please enter your name initials (1-4 letters)")

        if not initials.isalpha():
            raise HTTPException(status_code=400, detail="Initials should contain only letters")

        # Build unique code: DIGITS-INITIALS-SECTION
        if section:
            code = f"{digits}-{initials}-{section}"
        else:
            code = f"{digits}-{initials}"

        # Check if this code already exists
        existing = db.query(User).filter(User.student_code == code, User.role == "student").first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"This ID ({code}) is already registered. If this is your ID, please use 'Sign In' instead."
            )

        # Create the student
        name = initials  # Use initials as display name
        user = User(
            name=name,
            student_code=code,
            role="student",
            section=section if section else None,
            is_approved=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return LoginResponse(token=token, user=_user_response(user))
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

        # Check if teacher is approved
        if hasattr(user, "is_approved") and user.is_approved is False:
            raise HTTPException(
                status_code=403,
                detail="Your account is pending approval. Please contact an administrator."
            )

        if not bcrypt.checkpw(data.password.encode("utf-8"), user.password_hash.encode("utf-8")):
            raise HTTPException(status_code=401, detail="Invalid email or password")

        token = create_access_token({"sub": str(user.id), "role": user.role})
        return LoginResponse(token=token, user=_user_response(user))
    finally:
        db.close()


@router.post("/teacher-request-access", response_model=UserResponse)
async def teacher_request_access(data: TeacherAccessRequestInput):
    """
    Teacher requests access. Account is created with is_approved=False.
    Admin must approve before the teacher can log in.
    """
    db = get_db()
    try:
        existing = db.query(User).filter(User.email.ilike(data.email)).first()
        if existing:
            raise HTTPException(status_code=400, detail="An account with this email already exists")

        hashed = bcrypt.hashpw(data.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        user = User(
            name=data.name,
            email=data.email,
            password_hash=hashed,
            role="teacher",
            is_approved=False,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return _user_response(user)
    finally:
        db.close()


@router.post("/register", response_model=UserResponse)
async def register_teacher(data: TeacherRegisterInput, admin: dict = Depends(require_admin)):
    """Admin creates a new teacher account (auto-approved)."""
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
            is_approved=True,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

        return _user_response(user)
    finally:
        db.close()


@router.put("/approve-teacher/{user_id}", response_model=UserResponse)
async def approve_teacher(user_id: int, admin: dict = Depends(require_admin)):
    """Admin approves a pending teacher account."""
    db = get_db()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
        if user.role not in ("teacher",):
            raise HTTPException(status_code=400, detail="Can only approve teacher accounts")

        user.is_approved = True
        db.commit()
        db.refresh(user)
        return _user_response(user)
    finally:
        db.close()


@router.get("/pending-teachers", response_model=list)
async def get_pending_teachers(admin: dict = Depends(require_teacher)):
    """List teachers waiting for approval."""
    db = get_db()
    try:
        pending = db.query(User).filter(
            User.role == "teacher",
            User.is_approved == False
        ).all()
        return [_user_response(u) for u in pending]
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
        section=current_user.get("section"),
        created_at=current_user.get("created_at"),
    )
