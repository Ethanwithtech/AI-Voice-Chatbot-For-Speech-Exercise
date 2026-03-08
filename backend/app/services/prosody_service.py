import numpy as np
from app.models.practice import ProsodyMetrics

try:
    import parselmouth
    from parselmouth.praat import call
    HAS_PARSELMOUTH = True
except ImportError:
    HAS_PARSELMOUTH = False


def analyze_prosody(wav_path: str, word_timestamps: list = None) -> ProsodyMetrics:
    if not HAS_PARSELMOUTH:
        return _fallback_prosody(word_timestamps)

    sound = parselmouth.Sound(wav_path)
    total_duration = sound.get_total_duration()

    pitch = call(sound, "To Pitch", 0.0, 75, 600)
    f0_values = pitch.selected_array["frequency"]
    f0_voiced = f0_values[f0_values > 0]

    f0_mean = float(np.mean(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    f0_std = float(np.std(f0_voiced)) if len(f0_voiced) > 0 else 0.0

    f0_range = float(np.max(f0_voiced) - np.min(f0_voiced)) if len(f0_voiced) > 0 else 0.0
    intonation_index = f0_range / f0_mean if f0_mean > 0 else 0.0

    intensity = call(sound, "To Intensity", 75, 0.0)
    silences = []
    threshold = call(intensity, "Get minimum", 0, 0, "Parabolic") + 25

    is_silent = False
    silence_start = 0.0

    for i in range(intensity.get_number_of_frames()):
        t = intensity.get_time_from_frame_number(i + 1)
        val = call(intensity, "Get value at time", t, "Cubic")
        if val < threshold:
            if not is_silent:
                is_silent = True
                silence_start = t
        else:
            if is_silent:
                is_silent = False
                dur = t - silence_start
                if dur >= 0.15:
                    silences.append({"start": silence_start, "end": t, "duration": dur})

    pause_count = len(silences)
    long_pauses = [s for s in silences if s["duration"] >= 0.5]
    long_pause_count = len(long_pauses)
    mean_pause_duration = float(np.mean([s["duration"] for s in silences])) if silences else 0.0

    total_pause_time = sum(s["duration"] for s in silences)
    total_speech_time = total_duration - total_pause_time

    word_count = len(word_timestamps) if word_timestamps else 0
    if word_count > 0 and total_duration > 0:
        speech_rate = (word_count / total_duration) * 60
    else:
        speech_rate = 0.0

    if word_count > 0 and total_speech_time > 0:
        articulation_rate = (word_count / total_speech_time) * 60
    else:
        articulation_rate = 0.0

    return ProsodyMetrics(
        speech_rate=round(speech_rate, 1),
        articulation_rate=round(articulation_rate, 1),
        pause_count=pause_count,
        mean_pause_duration=round(mean_pause_duration, 3),
        long_pause_count=long_pause_count,
        f0_mean=round(f0_mean, 1),
        f0_std=round(f0_std, 1),
        intonation_index=round(intonation_index, 3),
        total_speech_time=round(total_speech_time, 2),
        total_duration=round(total_duration, 2),
    )


def _fallback_prosody(word_timestamps: list = None) -> ProsodyMetrics:
    """Fallback when parselmouth is not available. Estimate from word timestamps."""
    word_count = len(word_timestamps) if word_timestamps else 0
    total_duration = 0.0
    pause_count = 0
    total_pause_time = 0.0

    if word_timestamps and len(word_timestamps) >= 2:
        total_duration = word_timestamps[-1].get("end", 0)
        for i in range(1, len(word_timestamps)):
            gap = word_timestamps[i].get("start", 0) - word_timestamps[i - 1].get("end", 0)
            if gap >= 0.15:
                pause_count += 1
                total_pause_time += gap

    speech_rate = (word_count / total_duration) * 60 if total_duration > 0 else 0.0
    total_speech_time = total_duration - total_pause_time
    articulation_rate = (word_count / total_speech_time) * 60 if total_speech_time > 0 else 0.0
    mean_pause = total_pause_time / pause_count if pause_count > 0 else 0.0

    return ProsodyMetrics(
        speech_rate=round(speech_rate, 1),
        articulation_rate=round(articulation_rate, 1),
        pause_count=pause_count,
        mean_pause_duration=round(mean_pause, 3),
        long_pause_count=sum(1 for ts in (word_timestamps or []) if False),
        f0_mean=0.0,
        f0_std=0.0,
        intonation_index=0.0,
        total_speech_time=round(total_speech_time, 2),
        total_duration=round(total_duration, 2),
    )


def evaluate_fluency(metrics: ProsodyMetrics) -> dict:
    score = 100.0
    feedback = []

    if metrics.speech_rate < 80:
        score -= 20
        feedback.append("Speech rate is quite slow. Try to speak more fluently.")
    elif metrics.speech_rate < 120:
        score -= 10
        feedback.append("Speech rate is slightly below average. Practice speaking a bit faster.")
    elif metrics.speech_rate > 200:
        score -= 15
        feedback.append("Speech rate is very fast. Try to slow down for clarity.")
    elif metrics.speech_rate > 170:
        score -= 5
        feedback.append("Speech rate is slightly fast but generally acceptable.")

    if metrics.long_pause_count > 5:
        score -= 20
        feedback.append("Too many long pauses detected. Try to maintain a more consistent flow.")
    elif metrics.long_pause_count > 3:
        score -= 10
        feedback.append("Several long pauses detected. Try to reduce hesitations.")

    if metrics.mean_pause_duration > 1.0:
        score -= 15
        feedback.append("Average pause duration is too long. Try to keep pauses shorter.")

    if HAS_PARSELMOUTH:
        if metrics.intonation_index < 0.1:
            score -= 15
            feedback.append("Intonation is quite flat. Try to add more pitch variation.")
        elif metrics.intonation_index < 0.2:
            score -= 5
            feedback.append("Intonation could be more varied. Practice emphasizing key words.")

    return {
        "fluency_score": max(0, min(100, round(score))),
        "prosody_score": max(0, min(100, round(score + 5))),
        "feedback": feedback,
    }
