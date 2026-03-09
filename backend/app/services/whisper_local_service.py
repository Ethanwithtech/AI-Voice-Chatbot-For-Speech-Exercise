import logging

logger = logging.getLogger(__name__)


def _check_whisper():
    try:
        import whisper
        return True
    except ImportError:
        return False


def transcribe_audio_local(audio_path: str) -> dict:
    """Transcribe audio using local OpenAI Whisper model with word-level timestamps."""
    if not _check_whisper():
        raise RuntimeError(
            "openai-whisper is not installed. "
            "Run: pip install openai-whisper"
        )

    model = _get_model()

    result = model.transcribe(
        audio_path,
        language="en",
        word_timestamps=True,
        verbose=False,
    )

    transcript = result.get("text", "").strip()
    word_timestamps = []

    for segment in result.get("segments", []):
        for w in segment.get("words", []):
            word_timestamps.append({
                "word": w.get("word", "").strip(),
                "start": round(w.get("start", 0), 3),
                "end": round(w.get("end", 0), 3),
            })

    duration = 0.0
    if word_timestamps:
        duration = word_timestamps[-1]["end"]
    elif result.get("segments"):
        duration = result["segments"][-1].get("end", 0)

    return {
        "transcript": transcript,
        "word_timestamps": word_timestamps,
        "duration": duration,
    }


_model_cache = None


def _get_model():
    """Load and cache the Whisper model. Uses 'base' for balance of speed/accuracy."""
    global _model_cache
    if _model_cache is None:
        import os
        import whisper
        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        logger.info(f"Loading Whisper model: {model_size}")
        _model_cache = whisper.load_model(model_size)
        logger.info(f"Whisper model '{model_size}' loaded successfully")
    return _model_cache
