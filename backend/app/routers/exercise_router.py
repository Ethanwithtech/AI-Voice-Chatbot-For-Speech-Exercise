from fastapi import APIRouter, HTTPException, Depends
from typing import List
from app.database import get_db, Exercise, User
from app.auth import get_current_user, require_teacher
from app.models.exercise import (
    CreateExerciseInput, UpdateExerciseInput, ExerciseResponse
)

router = APIRouter()


@router.get("/", response_model=List[ExerciseResponse])
async def list_exercises(current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        exercises = db.query(Exercise).order_by(Exercise.created_at.desc()).all()

        result = []
        for ex in exercises:
            teacher = db.query(User).filter(User.id == ex.teacher_id).first()
            teacher_name = teacher.name if teacher else None
            result.append(ExerciseResponse(
                id=ex.id,
                teacher_id=ex.teacher_id,
                title=ex.title,
                description=ex.description,
                reference_text=ex.reference_text,
                difficulty=ex.difficulty,
                exercise_type=ex.exercise_type,
                created_at=ex.created_at.isoformat() if ex.created_at else None,
                teacher_name=teacher_name,
            ))
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
        teacher_name = teacher.name if teacher else None

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
        )
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
        )
        db.add(ex)
        db.commit()
        db.refresh(ex)

        return ExerciseResponse(
            id=ex.id,
            teacher_id=ex.teacher_id,
            title=ex.title,
            description=ex.description,
            reference_text=ex.reference_text,
            difficulty=ex.difficulty,
            exercise_type=ex.exercise_type,
            created_at=ex.created_at.isoformat() if ex.created_at else None,
            teacher_name=teacher["name"],
        )
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

        return ExerciseResponse(
            id=ex.id,
            teacher_id=ex.teacher_id,
            title=ex.title,
            description=ex.description,
            reference_text=ex.reference_text,
            difficulty=ex.difficulty,
            exercise_type=ex.exercise_type,
            created_at=ex.created_at.isoformat() if ex.created_at else None,
            teacher_name=teacher["name"],
        )
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
