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
    """
    Evaluate fluency with detailed breakdown.

    Returns fluency_score, prosody_score, fluency_level, and detailed feedback.

    Fluency dimensions:
    1. Speech rate (words per minute)
    2. Pause patterns (frequency and duration)
    3. Intonation variety (pitch range)
    4. Rhythm consistency (articulation vs overall rate)
    """
    score = 100.0
    feedback = []
    details = {}

    # ── 1. Speech Rate Assessment ──
    rate = metrics.speech_rate
    if rate < 80:
        score -= 20
        feedback.append("Speech rate is quite slow ({:.0f} wpm). Native speakers typically speak at 120-150 wpm in presentations. Try to speak more fluently.".format(rate))
        details["speech_rate_assessment"] = "too_slow"
    elif rate < 100:
        score -= 12
        feedback.append("Speech rate is below average ({:.0f} wpm). Target 120-150 wpm for natural flow.".format(rate))
        details["speech_rate_assessment"] = "slow"
    elif rate < 120:
        score -= 5
        feedback.append("Speech rate ({:.0f} wpm) is slightly below the ideal range. You're close to natural pace.".format(rate))
        details["speech_rate_assessment"] = "slightly_slow"
    elif rate <= 170:
        feedback.append("Good speech rate ({:.0f} wpm) — natural and easy to follow.".format(rate))
        details["speech_rate_assessment"] = "good"
    elif rate <= 200:
        score -= 5
        feedback.append("Speech rate is slightly fast ({:.0f} wpm). Consider slowing down at key points for emphasis.".format(rate))
        details["speech_rate_assessment"] = "slightly_fast"
    else:
        score -= 15
        feedback.append("Speech rate is very fast ({:.0f} wpm). Slow down for clarity — your listener needs time to process.".format(rate))
        details["speech_rate_assessment"] = "too_fast"

    details["speech_rate_wpm"] = round(rate, 1)

    # ── 2. Pause Pattern Assessment ──
    if metrics.long_pause_count > 5:
        score -= 20
        feedback.append("Too many long pauses ({}) detected. This suggests hesitation or difficulty finding words. Practice with an outline.".format(metrics.long_pause_count))
        details["pause_assessment"] = "excessive_hesitation"
    elif metrics.long_pause_count > 3:
        score -= 10
        feedback.append("Several long pauses ({}) detected. Try to reduce hesitations — brief pauses are natural, but extended ones break the flow.".format(metrics.long_pause_count))
        details["pause_assessment"] = "frequent_hesitation"
    elif metrics.long_pause_count >= 1:
        feedback.append("A few natural pauses detected. Good use of pausing for emphasis.")
        details["pause_assessment"] = "natural"
    else:
        feedback.append("Very few pauses — smooth delivery.")
        details["pause_assessment"] = "fluent"

    if metrics.mean_pause_duration > 1.5:
        score -= 15
        feedback.append("Average pause duration is very long ({:.1f}s). Try to keep pauses under 1 second.".format(metrics.mean_pause_duration))
    elif metrics.mean_pause_duration > 1.0:
        score -= 8
        feedback.append("Average pause duration ({:.1f}s) is slightly long. Brief pauses (0.3-0.7s) sound more natural.".format(metrics.mean_pause_duration))

    # ── 3. Rhythm Consistency ──
    if metrics.articulation_rate > 0 and metrics.speech_rate > 0:
        rhythm_ratio = metrics.speech_rate / metrics.articulation_rate
        if rhythm_ratio < 0.6:
            score -= 10
            feedback.append("Large gap between speaking and pausing time suggests frequent stops. Practice delivering longer phrases without breaks.")
            details["rhythm"] = "choppy"
        elif rhythm_ratio < 0.75:
            score -= 3
            details["rhythm"] = "slightly_uneven"
        else:
            details["rhythm"] = "consistent"

    # ── 4. Intonation Variety ──
    if HAS_PARSELMOUTH:
        if metrics.intonation_index < 0.08:
            score -= 18
            feedback.append("Intonation is very flat (monotone). Add pitch variation: rise for questions, fall for statements, emphasize key words.")
            details["intonation"] = "monotone"
        elif metrics.intonation_index < 0.15:
            score -= 8
            feedback.append("Intonation could be more varied. Practice emphasizing important words and using rising/falling tones.")
            details["intonation"] = "limited"
        elif metrics.intonation_index < 0.25:
            score -= 2
            feedback.append("Reasonable intonation variety. Keep working on natural pitch patterns.")
            details["intonation"] = "adequate"
        else:
            feedback.append("Good intonation variety — your speech sounds natural and engaging.")
            details["intonation"] = "expressive"
    else:
        details["intonation"] = "not_measured"

    # ── 5. Overall Duration Check ──
    if metrics.total_duration < 10:
        score -= 10
        feedback.append("Response was very short ({:.0f}s). Try to develop your ideas more fully.".format(metrics.total_duration))
    elif metrics.total_duration < 30:
        feedback.append("Response was brief ({:.0f}s). For CRAA, aim to use the full 2 minutes.".format(metrics.total_duration))

    # ── Calculate Fluency Level ──
    final_fluency = max(0, min(100, round(score)))
    final_prosody = max(0, min(100, round(score + 5)))

    if final_fluency >= 85:
        fluency_level = "Advanced"
        level_desc = "Highly fluent with natural rhythm and clear delivery."
    elif final_fluency >= 70:
        fluency_level = "Upper-Intermediate"
        level_desc = "Good fluency with minor hesitations."
    elif final_fluency >= 55:
        fluency_level = "Intermediate"
        level_desc = "Adequate fluency but noticeable pauses and pacing issues."
    elif final_fluency >= 40:
        fluency_level = "Pre-Intermediate"
        level_desc = "Frequent hesitations affecting comprehension."
    else:
        fluency_level = "Elementary"
        level_desc = "Significant fluency challenges requiring focused practice."

    details["fluency_level"] = fluency_level
    details["fluency_level_description"] = level_desc

    return {
        "fluency_score": final_fluency,
        "prosody_score": final_prosody,
        "fluency_level": fluency_level,
        "feedback": feedback,
        "details": details,
    }
