from pydantic import BaseModel
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
    last_four_digits: str
    initials: str
    section: Optional[str] = None


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
    reason: Optional[str] = None


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
