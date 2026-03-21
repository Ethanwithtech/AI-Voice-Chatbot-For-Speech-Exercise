"""
STT engine dispatcher.

Supports two engines:
  - whisper_local: Local faster-whisper (CTranslate2). Provides word-level
    confidence scores essential for pronunciation assessment. Installed at
    runtime on first use if not present (to keep deployment bundle small).
  - elevenlabs: Cloud-based ElevenLabs Scribe v2 API.

Engine selection (STT_ENGINE env var):
  - "auto" (default): Use ElevenLabs if API key is set, otherwise whisper_local.
  - "whisper_local": Force local Whisper (will runtime-install if needed).
  - "elevenlabs": Force ElevenLabs (requires API key).
"""

import logging
import httpx
from app.config import settings

logger = logging.getLogger(__name__)


def _get_stt_engine() -> str:
    """Determine which STT engine to use."""
    engine = settings.STT_ENGINE.lower()

    if engine == "auto":
        if settings.ELEVENLABS_API_KEY:
            return "elevenlabs"
        else:
            # No cloud API key — use local Whisper
            # (will be runtime-installed on first use if not present)
            logger.info("STT_ENGINE=auto, no ELEVENLABS_API_KEY — using whisper_local")
            return "whisper_local"

    if engine == "elevenlabs" and not settings.ELEVENLABS_API_KEY:
        logger.warning(
            "STT_ENGINE=elevenlabs but ELEVENLABS_API_KEY not set. "
            "Falling back to whisper_local."
        )
        return "whisper_local"

    return engine


async def transcribe_audio(audio_path: str) -> dict:
    """Transcribe audio using the configured STT engine."""
    engine = _get_stt_engine()

    if engine == "elevenlabs":
        return await _transcribe_elevenlabs(audio_path)
    elif engine == "whisper_local":
        return _transcribe_whisper_local(audio_path)
    else:
        raise ValueError(f"Unknown STT engine: {engine}")


async def _transcribe_elevenlabs(audio_path: str) -> dict:
    """Transcribe audio using ElevenLabs Scribe v2 API."""
    url = "https://api.elevenlabs.io/v1/speech-to-text"
    headers = {
        "xi-api-key": settings.ELEVENLABS_API_KEY,
    }

    with open(audio_path, "rb") as audio_file:
        files = {
            "file": ("audio.wav", audio_file, "audio/wav"),
        }
        data = {
            "model_id": "scribe_v2",
            "language_code": "en",
            "timestamps_granularity": "word",
            "tag_audio_events": "false",
            "diarize": "false",
        }

        async with httpx.AsyncClient(timeout=120.0) as client:
            response = await client.post(url, headers=headers, files=files, data=data)

    if response.status_code != 200:
        raise Exception(f"ElevenLabs STT failed: {response.status_code} - {response.text}")

    result = response.json()

    transcript = result.get("text", "")
    word_timestamps = []
    word_confidences = []

    for w in result.get("words", []):
        if w.get("type") == "word":
            word_text = w.get("text", "")
            start = w.get("start", 0)
            end = w.get("end", 0)
            # ElevenLabs may provide confidence; default to 0.85 if not available
            confidence = w.get("confidence", 0.85)

            word_timestamps.append({
                "word": word_text,
                "start": start,
                "end": end,
            })
            word_confidences.append({
                "word": word_text,
                "confidence": round(confidence, 4),
                "start": start,
                "end": end,
            })

    duration = 0
    if word_timestamps:
        duration = word_timestamps[-1]["end"]

    return {
        "transcript": transcript,
        "word_timestamps": word_timestamps,
        "word_confidences": word_confidences,
        "duration": duration,
    }


def _transcribe_whisper_local(audio_path: str) -> dict:
    """Transcribe audio using local faster-whisper model.

    If faster-whisper is not installed, it will be automatically
    installed at runtime on first call (~2-3 min one-time cost).
    """
    from app.services.whisper_local_service import transcribe_audio_local
    return transcribe_audio_local(audio_path)
