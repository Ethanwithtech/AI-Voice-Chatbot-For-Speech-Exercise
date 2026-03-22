"""
Local Whisper STT service with runtime lazy-install.

Strategy for Replit deployment:
  - faster-whisper (~500MB with ctranslate2) is NOT installed during build
    to keep Bundle small and avoid the 10-minute timeout.
  - On first user request that needs STT, this module:
    1. Detects that faster-whisper is missing
    2. Installs it via pip at runtime (~2-3 minutes one-time cost)
    3. Loads the Whisper model (~140MB download for "base")
    4. Caches everything for subsequent requests

This is a ONE-TIME cost on the first audio submission after each deployment.
All subsequent requests use the cached model instantly.
"""

import logging
import os
import subprocess
import sys

logger = logging.getLogger(__name__)

_model_cache = None
_install_attempted = False


def _ensure_faster_whisper_installed():
    """Install faster-whisper at runtime if not already available.

    This allows the Replit deployment bundle to stay small (no ~500MB
    ctranslate2 in the bundle), while still having full Whisper
    functionality when a user first submits audio.
    """
    global _install_attempted

    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        pass

    if _install_attempted:
        # Already tried once and it failed or is still running
        logger.error("[whisper] faster-whisper install was already attempted and failed")
        return False

    _install_attempted = True
    logger.info("[whisper] faster-whisper not found — installing at runtime (one-time ~2-3 min)...")

    try:
        # Install faster-whisper into .pythonlibs site-packages
        # (same location as build.sh installs other packages)
        target_dir = "/home/runner/workspace/.pythonlibs/lib/python3.11/site-packages"
        install_cmd = [
            sys.executable, "-m", "pip", "install",
            "--no-cache-dir",
            "--quiet",
            "faster-whisper==1.1.1",
        ]
        # Use --target if the directory exists (Replit deploy environment)
        if os.path.isdir(os.path.dirname(target_dir)):
            os.makedirs(target_dir, exist_ok=True)
            install_cmd.extend(["--target", target_dir])

        result = subprocess.run(
            install_cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minute timeout for install
        )

        if result.returncode != 0:
            logger.error(f"[whisper] pip install failed (exit {result.returncode}): {result.stderr}")
            return False

        logger.info("[whisper] faster-whisper installed successfully!")

        # Verify import works after install
        import importlib
        importlib.invalidate_caches()

        # Try importing — may need to reload
        try:
            import faster_whisper  # noqa: F401
            return True
        except ImportError:
            # Sometimes importlib needs a harder push
            import importlib.util
            spec = importlib.util.find_spec("faster_whisper")
            if spec is not None:
                return True
            logger.error("[whisper] faster-whisper installed but still cannot import")
            return False

    except subprocess.TimeoutExpired:
        logger.error("[whisper] faster-whisper install timed out (>10 min)")
        return False
    except Exception as e:
        logger.error(f"[whisper] faster-whisper install error: {e}")
        return False


def transcribe_audio_local(audio_path: str) -> dict:
    """Transcribe audio using faster-whisper (CTranslate2 backend, no PyTorch needed).

    Returns transcript, word_timestamps, word_confidences, and duration.
    word_confidences contains per-word probability scores from Whisper,
    which are used for pronunciation quality assessment.

    On first call after deployment, this may take extra time to install
    faster-whisper (~2-3 min) and download the model (~1 min).
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
    """Load and cache the faster-whisper model.

    Installs faster-whisper at runtime if not present (lazy install).
    Downloads the Whisper model on first use.
    """
    global _model_cache
    if _model_cache is None:
        # Ensure faster-whisper is installed (runtime install if needed)
        if not _ensure_faster_whisper_installed():
            raise RuntimeError(
                "faster-whisper is not available and could not be installed. "
                "STT functionality is unavailable. Check deployment logs."
            )

        from faster_whisper import WhisperModel  # lazy import

        model_size = os.getenv("WHISPER_MODEL_SIZE", "base")
        cache_dir = os.getenv("WHISPER_CACHE_DIR", "/tmp/whisper_cache")
        os.makedirs(cache_dir, exist_ok=True)

        logger.info(f"Loading faster-whisper model: {model_size} (cache: {cache_dir})")
        _model_cache = WhisperModel(
            model_size,
            device="cpu",
            compute_type="int8",
            download_root=cache_dir,
        )
        logger.info(f"faster-whisper model '{model_size}' loaded successfully")

    return _model_cache


def is_available() -> bool:
    """Check if faster-whisper is currently importable (without installing)."""
    try:
        import faster_whisper  # noqa: F401
        return True
    except ImportError:
        return False
