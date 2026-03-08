from pydantic import BaseModel
from typing import Optional, List


class ProsodyMetrics(BaseModel):
    speech_rate: float = 0.0
    articulation_rate: float = 0.0
    pause_count: int = 0
    mean_pause_duration: float = 0.0
    long_pause_count: int = 0
    f0_mean: float = 0.0
    f0_std: float = 0.0
    intonation_index: float = 0.0
    total_speech_time: float = 0.0
    total_duration: float = 0.0


class PronunciationIssue(BaseModel):
    word: str
    expected: Optional[str] = None
    timestamp: float = 0.0
    confidence: float = 0.0


class GrammarError(BaseModel):
    sentence: str
    correction: str
    explanation: str


class AnalysisScores(BaseModel):
    overall: float = 0.0
    grammar: float = 0.0
    fluency: float = 0.0
    pronunciation: float = 0.0
    prosody: float = 0.0


class AnalysisResult(BaseModel):
    transcript: str = ""
    word_timestamps: list = []
    prosody: ProsodyMetrics = ProsodyMetrics()
    pronunciation_issues: List[PronunciationIssue] = []
    is_read_aloud: Optional[bool] = None
    scores: AnalysisScores = AnalysisScores()
    errors: List[GrammarError] = []
    suggestions: List[str] = []
    llm_feedback: str = ""


class PracticeSessionResponse(BaseModel):
    id: int
    student_id: int
    exercise_id: Optional[int] = None
    transcript: Optional[str] = None
    duration_seconds: Optional[float] = None
    created_at: Optional[str] = None
    result: Optional[dict] = None
    exercise_title: Optional[str] = None
