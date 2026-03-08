from pydantic import BaseModel, EmailStr
from typing import Optional
from enum import Enum


class UserRole(str, Enum):
    student = "student"
    teacher = "teacher"
    admin = "admin"


class StudentLoginInput(BaseModel):
    student_code: str  # e.g. "JS123456"


class TeacherLoginInput(BaseModel):
    email: str
    password: str


class TeacherRegisterInput(BaseModel):
    name: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: Optional[str] = None
    role: str
    student_code: Optional[str] = None
    created_at: Optional[str] = None


class LoginResponse(BaseModel):
    token: str
    user: UserResponse
