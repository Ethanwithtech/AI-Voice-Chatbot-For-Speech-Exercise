import logging
import os

logger = logging.getLogger(__name__)


def _check_faster_whisper():
    try:
        from faster_whisper import WhisperModel  # noqa: F401
        return True
    except ImportError:
        return False


def transcribe_audio_local(audio_path: str) -> dict:
    """Transcribe audio using faster-whisper (CTranslate2 backend, no PyTorch needed)."""
    if not _check_faster_whisper():
        raise RuntimeError(
            "faster-whisper is not installed. "
            "Run: pip install faster-whisper"
        )

    model = _get_model()

    segments, _ = model.transcribe(
        audio_path,
        language="en",
        word_timestamps=True,
        vad_filter=True,
    )

    transcript_parts = []
    word_timestamps = []

    for segment in segments:
        transcript_parts.append(segment.text.strip())
        if segment.words:
            for w in segment.words:
                word_timestamps.append({
                    "word": w.word.strip(),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

    transcript = " ".join(transcript_parts).strip()

    duration = 0.0
    if word_timestamps:
        duration = word_timestamps[-1]["end"]

    return {
        "transcript": transcript,
        "word_timestamps": word_timestamps,
        "duration": duration,
    }


_model_cache = None


def _get_model():
    """Load and cache the faster-whisper model."""
    global _model_cache
    if _model_cache is None:
        from faster_whisper import WhisperModel
        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        logger.info(f"Loading faster-whisper model: {model_size}")
        _model_cache = WhisperModel(model_size, device="cpu", compute_type="int8")
        logger.info(f"faster-whisper model '{model_size}' loaded successfully")
    return _model_cache
