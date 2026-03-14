import logging
import os

logger = logging.getLogger(__name__)

try:
    from faster_whisper import WhisperModel
    HAS_WHISPER = True
except ImportError:
    HAS_WHISPER = False
    logger.warning("faster-whisper not installed. Local Whisper STT unavailable.")


def transcribe_audio_local(audio_path: str) -> dict:
    """Transcribe audio using faster-whisper (CTranslate2) with word-level timestamps."""
    if not HAS_WHISPER:
        raise RuntimeError(
            "faster-whisper is not installed. "
            "Run: pip install faster-whisper"
        )

    model = _get_model()

    segments, info = model.transcribe(
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

    transcript = " ".join(transcript_parts)

    duration = 0.0
    if word_timestamps:
        duration = word_timestamps[-1]["end"]
    elif info.duration:
        duration = info.duration

    return {
        "transcript": transcript,
        "word_timestamps": word_timestamps,
        "duration": duration,
    }


_model_cache = None


def _get_model():
    """Load and cache the faster-whisper model. Uses 'base' for balance of speed/accuracy."""
    global _model_cache
    if _model_cache is None:
        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        compute_type = os.getenv("WHISPER_COMPUTE_TYPE", "int8")
        logger.info(f"Loading faster-whisper model: {model_size} (compute_type={compute_type})")
        _model_cache = WhisperModel(
            model_size,
            device="cpu",
            compute_type=compute_type,
        )
        logger.info(f"faster-whisper model '{model_size}' loaded successfully")
    return _model_cache
