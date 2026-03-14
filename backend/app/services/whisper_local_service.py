import logging
import os

logger = logging.getLogger(__name__)

# NOTE: faster-whisper / CTranslate2 is intentionally NOT imported at module level.
# It is imported lazily inside functions to prevent slow C-extension loading from
# blocking app startup and failing deployment health checks.

_model_cache = None


def transcribe_audio_local(audio_path: str) -> dict:
    """Transcribe audio using faster-whisper (CTranslate2 backend, no PyTorch needed)."""
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


def _get_model():
    """Load and cache the faster-whisper model (lazy — imported only on first call)."""
    global _model_cache
    if _model_cache is None:
        from faster_whisper import WhisperModel  # lazy import — keeps startup fast
        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        cache_dir = os.getenv("WHISPER_CACHE_DIR", "/tmp/whisper_cache")
        os.makedirs(cache_dir, exist_ok=True)
        logger.info(f"Loading faster-whisper model: {model_size} (cache: {cache_dir})")
        _model_cache = WhisperModel(model_size, device="cpu", compute_type="int8", download_root=cache_dir)
        logger.info(f"faster-whisper model '{model_size}' loaded successfully")
    return _model_cache
