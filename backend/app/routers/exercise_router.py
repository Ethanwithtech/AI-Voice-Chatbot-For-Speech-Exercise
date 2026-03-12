from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from fastapi.responses import Response
from typing import List
from app.database import get_db, Exercise, User
from app.auth import get_current_user, require_teacher
from app.models.exercise import (
    CreateExerciseInput, UpdateExerciseInput, ExerciseResponse
)

router = APIRouter()


def _exercise_to_response(ex: Exercise, teacher_name: str = None) -> ExerciseResponse:
    return ExerciseResponse(
        id=ex.id,
        teacher_id=ex.teacher_id,
        title=ex.title,
        description=ex.description,
        reference_text=ex.reference_text,
        difficulty=ex.difficulty,
        exercise_type=ex.exercise_type,
        created_at=ex.created_at.isoformat() if ex.created_at else None,
        teacher_name=teacher_name,
        argument_text=ex.argument_text,
        topic_context=ex.topic_context,
        key_claim=ex.key_claim,
        preparation_time=ex.preparation_time,
        response_time=ex.response_time,
        has_argument_audio=bool(ex.argument_audio_data),
    )


@router.get("/", response_model=List[ExerciseResponse])
async def list_exercises(current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        exercises = db.query(Exercise).order_by(Exercise.created_at.desc()).all()
        result = []
        for ex in exercises:
            teacher = db.query(User).filter(User.id == ex.teacher_id).first()
            result.append(_exercise_to_response(ex, teacher.name if teacher else None))
        return result
    finally:
        db.close()


@router.get("/{exercise_id}", response_model=ExerciseResponse)
async def get_exercise(exercise_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")
        teacher = db.query(User).filter(User.id == ex.teacher_id).first()
        return _exercise_to_response(ex, teacher.name if teacher else None)
    finally:
        db.close()


@router.post("/", response_model=ExerciseResponse)
async def create_exercise(data: CreateExerciseInput, teacher: dict = Depends(require_teacher)):
    db = get_db()
    try:
        ex = Exercise(
            teacher_id=teacher["id"],
            title=data.title,
            description=data.description,
            reference_text=data.reference_text,
            difficulty=data.difficulty.value,
            exercise_type=data.exercise_type.value,
            argument_text=data.argument_text,
            topic_context=data.topic_context,
            key_claim=data.key_claim,
            preparation_time=data.preparation_time,
            response_time=data.response_time,
        )
        db.add(ex)
        db.commit()
        db.refresh(ex)
        return _exercise_to_response(ex, teacher["name"])
    finally:
        db.close()


@router.put("/{exercise_id}", response_model=ExerciseResponse)
async def update_exercise(exercise_id: int, data: UpdateExerciseInput, teacher: dict = Depends(require_teacher)):
    db = get_db()
    try:
        ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")

        if ex.teacher_id != teacher["id"] and teacher["role"] != "admin":
            raise HTTPException(status_code=403, detail="You can only edit your own exercises")

        update_data = {k: v.value if hasattr(v, "value") else v for k, v in data.dict(exclude_none=True).items()}
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")

        for key, value in update_data.items():
            setattr(ex, key, value)

        db.commit()
        db.refresh(ex)
        return _exercise_to_response(ex, teacher["name"])
    finally:
        db.close()


@router.delete("/{exercise_id}")
async def delete_exercise(exercise_id: int, teacher: dict = Depends(require_teacher)):
    db = get_db()
    try:
        ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")

        if ex.teacher_id != teacher["id"] and teacher["role"] != "admin":
            raise HTTPException(status_code=403, detail="You can only delete your own exercises")

        db.delete(ex)
        db.commit()
        return {"message": "Exercise deleted successfully"}
    finally:
        db.close()


@router.post("/{exercise_id}/argument-audio")
async def upload_argument_audio(
    exercise_id: int,
    audio: UploadFile = File(...),
    teacher: dict = Depends(require_teacher),
):
    db = get_db()
    try:
        ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")

        if ex.teacher_id != teacher["id"] and teacher["role"] != "admin":
            raise HTTPException(status_code=403, detail="You can only edit your own exercises")

        file_bytes = await audio.read()
        if len(file_bytes) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="Audio file too large (max 50MB)")

        content_type = (audio.content_type or "audio/webm").split(";")[0].strip()
        ex.argument_audio_data = file_bytes
        ex.argument_audio_type = content_type
        db.commit()
        return {"message": "Argument audio uploaded successfully", "size": len(file_bytes)}
    finally:
        db.close()


@router.get("/{exercise_id}/argument-audio")
async def get_argument_audio(exercise_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")

        if not ex.argument_audio_data:
            raise HTTPException(status_code=404, detail="No argument audio available")

        content_type = ex.argument_audio_type or "audio/webm"
        ext_map = {
            "audio/webm": ".webm", "audio/wav": ".wav", "audio/mp3": ".mp3",
            "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/mp4": ".mp4",
        }
        ext = ext_map.get(content_type, ".webm")
        return Response(
            content=ex.argument_audio_data,
            media_type=content_type,
            headers={"Content-Disposition": f"inline; filename=argument_{exercise_id}{ext}"},
        )
    finally:
        db.close()
