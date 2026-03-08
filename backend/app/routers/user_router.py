from fastapi import APIRouter, HTTPException, Depends
from typing import List
from sqlalchemy import func
from app.database import get_db, User, PracticeSession, TokenUsage
from app.auth import require_teacher, require_admin, user_to_dict
from app.models.user import UserResponse

router = APIRouter()


@router.get("/students", response_model=List[UserResponse])
async def list_students(teacher: dict = Depends(require_teacher)):
    db = get_db()
    try:
        students = db.query(User).filter(User.role == "student").order_by(User.created_at.desc()).all()
        return [
            UserResponse(
                id=u.id,
                name=u.name,
                email=u.email,
                role=u.role,
                student_code=u.student_code,
                created_at=u.created_at.isoformat() if u.created_at else None,
            )
            for u in students
        ]
    finally:
        db.close()


@router.get("/teachers", response_model=List[UserResponse])
async def list_teachers(admin: dict = Depends(require_admin)):
    db = get_db()
    try:
        teachers = db.query(User).filter(User.role.in_(["teacher", "admin"])).order_by(User.created_at.desc()).all()
        return [
            UserResponse(
                id=u.id,
                name=u.name,
                email=u.email,
                role=u.role,
                created_at=u.created_at.isoformat() if u.created_at else None,
            )
            for u in teachers
        ]
    finally:
        db.close()


@router.get("/{user_id}/sessions")
async def get_user_sessions(user_id: int, teacher: dict = Depends(require_teacher)):
    db = get_db()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        sessions = db.query(PracticeSession).filter(
            PracticeSession.student_id == user_id
        ).order_by(PracticeSession.created_at.desc()).all()

        sessions_data = []
        for s in sessions:
            practice_result = None
            if s.results:
                pr = s.results[0]
                practice_result = {
                    "id": pr.id,
                    "overall_score": pr.overall_score,
                    "grammar_score": pr.grammar_score,
                    "fluency_score": pr.fluency_score,
                    "pronunciation_score": pr.pronunciation_score,
                    "prosody_score": pr.prosody_score,
                    "created_at": pr.created_at.isoformat() if pr.created_at else None,
                }

            exercise_title = s.exercise.title if s.exercise else None

            sessions_data.append({
                "id": s.id,
                "student_id": s.student_id,
                "exercise_id": s.exercise_id,
                "transcript": s.transcript,
                "duration_seconds": s.duration_seconds,
                "has_audio": s.audio_data is not None and len(s.audio_data) > 0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "practice_results": [practice_result] if practice_result else [],
                "exercise_title": exercise_title,
            })

        return {
            "user": UserResponse(
                id=user.id,
                name=user.name,
                email=user.email,
                role=user.role,
                student_code=user.student_code,
                created_at=user.created_at.isoformat() if user.created_at else None,
            ),
            "sessions": sessions_data,
        }
    finally:
        db.close()


@router.get("/token-stats")
async def get_token_stats(teacher: dict = Depends(require_teacher)):
    """Get token usage statistics for the teacher dashboard."""
    db = get_db()
    try:
        # Total tokens used
        total_result = db.query(func.sum(TokenUsage.tokens_used)).scalar()
        total_tokens = total_result or 0

        # Total sessions count
        total_sessions = db.query(func.count(PracticeSession.id)).scalar() or 0

        # Total students
        total_students = db.query(func.count(User.id)).filter(User.role == "student").scalar() or 0

        # Token usage by service
        by_service = db.query(
            TokenUsage.service,
            func.sum(TokenUsage.tokens_used),
            func.count(TokenUsage.id),
        ).group_by(TokenUsage.service).all()

        services = []
        for service_name, tokens, count in by_service:
            services.append({
                "service": service_name,
                "total_tokens": tokens or 0,
                "request_count": count,
            })

        # Recent usage (last 10)
        recent = db.query(TokenUsage).order_by(TokenUsage.created_at.desc()).limit(10).all()
        recent_data = []
        for r in recent:
            user = db.query(User).filter(User.id == r.user_id).first()
            recent_data.append({
                "id": r.id,
                "user_name": user.name if user else "Unknown",
                "service": r.service,
                "tokens_used": r.tokens_used,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            })

        return {
            "total_tokens": total_tokens,
            "total_sessions": total_sessions,
            "total_students": total_students,
            "by_service": services,
            "recent_usage": recent_data,
        }
    finally:
        db.close()
