from pydantic import BaseModel
from typing import Optional
from enum import Enum


class DifficultyLevel(str, Enum):
    easy = "easy"
    medium = "medium"
    hard = "hard"


class ExerciseType(str, Enum):
    read_aloud = "read_aloud"
    free_speech = "free_speech"
    qa = "qa"
    craa = "craa"


class CreateExerciseInput(BaseModel):
    title: str
    description: str
    reference_text: Optional[str] = None
    difficulty: DifficultyLevel = DifficultyLevel.medium
    exercise_type: ExerciseType = ExerciseType.free_speech
    argument_text: Optional[str] = None
    topic_context: Optional[str] = None
    key_claim: Optional[str] = None
    preparation_time: Optional[int] = 120
    response_time: Optional[int] = 120
    video_url: Optional[str] = None


class UpdateExerciseInput(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    reference_text: Optional[str] = None
    difficulty: Optional[DifficultyLevel] = None
    exercise_type: Optional[ExerciseType] = None
    argument_text: Optional[str] = None
    topic_context: Optional[str] = None
    key_claim: Optional[str] = None
    preparation_time: Optional[int] = None
    response_time: Optional[int] = None
    video_url: Optional[str] = None


class ExerciseResponse(BaseModel):
    id: int
    teacher_id: int
    title: str
    description: str
    reference_text: Optional[str] = None
    difficulty: str
    exercise_type: str
    created_at: Optional[str] = None
    teacher_name: Optional[str] = None
    argument_text: Optional[str] = None
    topic_context: Optional[str] = None
    key_claim: Optional[str] = None
    preparation_time: Optional[int] = None
    response_time: Optional[int] = None
    has_argument_audio: Optional[bool] = False
    video_url: Optional[str] = None
