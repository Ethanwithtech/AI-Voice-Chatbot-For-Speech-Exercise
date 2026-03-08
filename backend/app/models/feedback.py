from pydantic import BaseModel
from typing import List, Optional


class FeedbackRequest(BaseModel):
    transcript: str
    reference_text: Optional[str] = None
    prosody_data: Optional[dict] = None
    pronunciation_issues: Optional[list] = None
    exercise_type: str = "free_speech"
    difficulty: str = "medium"


class StructuredFeedback(BaseModel):
    overall_assessment: str = ""
    score: float = 0.0
    grammar_errors: List[dict] = []
    suggestions: List[str] = []
    strengths: List[str] = []
    areas_to_improve: List[str] = []
    prosody_feedback: Optional[str] = None
    pronunciation_feedback: Optional[str] = None
