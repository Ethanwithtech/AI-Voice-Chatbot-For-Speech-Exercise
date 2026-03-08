from typing import Optional
from app.models.practice import ProsodyMetrics


def detect_read_aloud(
    transcript: str,
    reference_text: Optional[str],
    prosody: ProsodyMetrics,
) -> Optional[bool]:
    if not reference_text:
        return None

    trans_words = set(transcript.lower().strip().split())
    ref_words = set(reference_text.lower().strip().split())

    if not trans_words or not ref_words:
        return None

    intersection = trans_words & ref_words
    jaccard = len(intersection) / len(trans_words | ref_words) if (trans_words | ref_words) else 0

    coverage = len(intersection) / len(ref_words) if ref_words else 0

    text_similarity_high = jaccard > 0.7 or coverage > 0.85

    regular_pauses = prosody.mean_pause_duration < 0.4 and prosody.long_pause_count <= 2
    steady_rate = 100 < prosody.speech_rate < 180

    prosody_suggests_reading = regular_pauses and steady_rate

    if text_similarity_high and prosody_suggests_reading:
        return True
    elif not text_similarity_high:
        return False

    return None
