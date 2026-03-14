from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class StudentLoginInput(BaseModel):
    student_code: str  # e.g. "6342-YD-A1"


class StudentRegisterInput(BaseModel):
    """3-step student registration: last 4 digits + initials + section."""
    last_four_digits: str   # Last 4 digits of student ID, e.g. "6342"
    initials: str           # First + Last name initials, e.g. "YD"
    section: Optional[str] = None  # Class section, e.g. "A1", "B2"


class TeacherLoginInput(BaseModel):
    email: str
    password: str


class TeacherRegisterInput(BaseModel):
    name: str
    email: str
    password: str


class TeacherAccessRequestInput(BaseModel):
    """Teacher requests access — admin must approve."""
    name: str
    email: str
    password: str
    reason: Optional[str] = None  # Why they need access


class UserResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    role: str
    student_code: Optional[str] = None
    section: Optional[str] = None
    created_at: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    user: UserResponse
