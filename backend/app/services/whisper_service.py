import httpx
from app.config import settings


async def transcribe_audio(audio_path: str) -> dict:
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

    for w in result.get("words", []):
        if w.get("type") == "word":
            word_timestamps.append({
                "word": w.get("text", ""),
                "start": w.get("start", 0),
                "end": w.get("end", 0),
            })

    # Estimate duration from last word end time
    duration = 0
    if word_timestamps:
        duration = word_timestamps[-1]["end"]

    return {
        "transcript": transcript,
        "word_timestamps": word_timestamps,
        "duration": duration,
    }
