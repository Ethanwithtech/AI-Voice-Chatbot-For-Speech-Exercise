import logging
import os

logger = logging.getLogger(__name__)

# NOTE: faster-whisper / CTranslate2 is intentionally NOT imported at module level.
# It is imported lazily inside functions to prevent slow C-extension loading from
# blocking app startup and failing deployment health checks.

_model_cache = None


def transcribe_audio_local(audio_path: str) -> dict:
    """Transcribe audio using faster-whisper (CTranslate2 backend, no PyTorch needed).

    Returns transcript, word_timestamps, word_confidences, and duration.
    word_confidences contains per-word probability scores from Whisper,
    which are used for pronunciation quality assessment.
    """
    model = _get_model()

    segments, _ = model.transcribe(
        audio_path,
        language="en",
        word_timestamps=True,
        vad_filter=True,
    )

    transcript_parts = []
    word_timestamps = []
    word_confidences = []

    for segment in segments:
        transcript_parts.append(segment.text.strip())
        if segment.words:
            for w in segment.words:
                word_text = w.word.strip()
                word_timestamps.append({
                    "word": word_text,
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })
                # faster-whisper exposes per-word probability as w.probability
                word_confidences.append({
                    "word": word_text,
                    "confidence": round(w.probability, 4),
                    "start": round(w.start, 3),
                    "end": round(w.end, 3),
                })

    transcript = " ".join(transcript_parts).strip()

    duration = 0.0
    if word_timestamps:
        duration = word_timestamps[-1]["end"]

    # Log confidence statistics
    if word_confidences:
        confs = [wc["confidence"] for wc in word_confidences]
        avg_conf = sum(confs) / len(confs)
        low_conf = sum(1 for c in confs if c < 0.6)
        logger.info(
            f"[whisper] Transcription complete: {len(word_confidences)} words, "
            f"avg_confidence={avg_conf:.3f}, low_confidence_words={low_conf}"
        )

    return {
        "transcript": transcript,
        "word_timestamps": word_timestamps,
        "word_confidences": word_confidences,
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
