import os
import uuid
import tempfile
from pydub import AudioSegment
from app.config import settings


def save_upload(file_bytes: bytes, filename: str) -> str:
    os.makedirs(settings.UPLOAD_DIR, exist_ok=True)
    ext = os.path.splitext(filename)[1] or ".webm"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    filepath = os.path.join(settings.UPLOAD_DIR, unique_name)

    with open(filepath, "wb") as f:
        f.write(file_bytes)

    return filepath


def convert_to_wav(input_path: str) -> str:
    wav_path = input_path.rsplit(".", 1)[0] + ".wav"

    audio = AudioSegment.from_file(input_path)
    audio = audio.set_channels(1).set_frame_rate(16000)
    audio.export(wav_path, format="wav")

    return wav_path


def get_audio_duration(filepath: str) -> float:
    audio = AudioSegment.from_file(filepath)
    return len(audio) / 1000.0


def cleanup_files(*paths: str):
    for path in paths:
        if path and os.path.exists(path):
            os.remove(path)
