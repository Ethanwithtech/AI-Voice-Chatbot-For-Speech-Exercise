"""
Pronunciation analysis service — Enhanced with audio-level detection.

Three-layer detection:
1. Whisper confidence-based: Uses word-level probability from faster-whisper
   to flag words the ASR model was uncertain about (likely mispronounced).
2. Reference-based: Edit-distance alignment for read-aloud exercises.
3. Phonetic-pattern: ESL pattern scanning on transcript text.

All three layers are combined for a comprehensive pronunciation score.
"""

import logging
from typing import List, Optional, Dict, Tuple
from app.models.practice import PronunciationIssue

logger = logging.getLogger(__name__)

# ── Common pronunciation pitfalls for Cantonese/Mandarin L1 English learners ──
# Each entry: spoken_pattern → (expected, IPA hint, tip)
COMMON_ESL_ISSUES = {
    # th → d/z/f confusion (dental fricatives)
    "da": ("the", "/ðə/", "Practice the voiced 'th' — place tongue between teeth"),
    "dey": ("they", "/ðeɪ/", "The 'th' in 'they' is voiced — tongue between teeth"),
    "dis": ("this", "/ðɪs/", "Practice the voiced 'th' sound"),
    "dat": ("that", "/ðæt/", "Practice the voiced 'th' sound"),
    "ting": ("thing", "/θɪŋ/", "Practice the voiceless 'th' — tongue between teeth, blow air"),
    "tink": ("think", "/θɪŋk/", "The 'th' in 'think' is voiceless"),
    "tree": ("three", "/θriː/", "Start with 'th' not 't'"),
    "true": ("through", "/θruː/", "Start with 'th' not 't'"),
    # l/r confusion
    "light": ("right", "/raɪt/", "Curl your tongue back slightly for the 'r' sound"),
    "lice": ("rice", "/raɪs/", "Curl tongue back for 'r'"),
    "lead": ("read", "/riːd/", "Ensure clear 'r' articulation"),
    # v/w confusion
    "wery": ("very", "/ˈveri/", "Bite lower lip gently for the 'v' sound"),
    "vet": ("wet", "/wet/", "Round lips for 'w', don't bite lip"),
    # n/l final confusion
    "can": ("can", None, None),  # skip — this is valid
    # Vowel confusions
    "man": ("men", "/men/", "The vowel in 'men' is /e/, shorter than /æ/ in 'man'"),
    "bed": ("bad", "/bæd/", "Open your mouth wider for the /æ/ vowel in 'bad'"),
    # Word stress issues (common words)
    "develop": ("develop", None, "Stress on second syllable: de-VEL-op"),
    "interesting": ("interesting", None, "Three syllables: IN-tres-ting, stress on first"),
    # Consonant cluster simplification
    "aks": ("ask", "/ɑːsk/", "Keep the /sk/ cluster — 'ask' not 'aks'"),
    "strick": ("strict", "/strɪkt/", "Pronounce the final /t/ clearly"),
    "worl": ("world", "/wɜːrld/", "Don't drop the final /d/"),
}

# Common English words that should have high ASR confidence.
# If Whisper gives low confidence on these, it's a strong signal of pronunciation issues.
HIGH_FREQUENCY_WORDS = {
    "the", "a", "an", "is", "are", "was", "were", "have", "has", "had",
    "do", "does", "did", "will", "would", "can", "could", "should",
    "this", "that", "these", "those", "it", "they", "we", "he", "she",
    "and", "but", "or", "so", "because", "if", "when", "while",
    "in", "on", "at", "to", "for", "with", "from", "by", "of", "about",
    "not", "no", "yes", "very", "also", "just", "only", "more", "most",
    "think", "believe", "know", "say", "said", "make", "take", "get",
    "people", "time", "important", "different", "however", "therefore",
    "argument", "evidence", "support", "suggest", "according",
}

# Words that are inherently difficult and should have a higher confidence threshold tolerance
ACADEMIC_WORDS = {
    "furthermore", "nevertheless", "consequently", "notwithstanding",
    "counterargument", "substantiate", "corroborate", "juxtaposition",
    "methodology", "paradigm", "phenomenon", "infrastructure",
    "sustainability", "entrepreneurship", "algorithm", "cryptocurrency",
}

# Confidence thresholds
CONF_LOW = 0.45          # Below this = very likely mispronounced
CONF_MEDIUM = 0.60       # Below this = possibly mispronounced
CONF_HIGH_FREQ_LOW = 0.55  # For common words, even slightly low confidence is suspicious


def detect_pronunciation_issues(
    transcript: str,
    word_timestamps: list,
    reference_text: Optional[str] = None,
    word_confidences: Optional[list] = None,
) -> List[PronunciationIssue]:
    """
    Detect pronunciation issues using all available signals.

    Args:
        transcript: The transcribed text
        word_timestamps: List of {word, start, end} dicts
        reference_text: Optional reference text for read-aloud exercises
        word_confidences: Optional list of {word, confidence, start, end} from Whisper

    Returns:
        List of PronunciationIssue objects
    """
    issues: List[PronunciationIssue] = []

    # Layer 1: Whisper confidence-based detection (audio-level)
    if word_confidences:
        issues.extend(_confidence_based_detection(word_confidences))
        logger.info(f"[pronunciation] Confidence-based: {len(issues)} issues found")

    # Layer 2: Reference-based detection (for read-aloud)
    if reference_text:
        ref_issues = _reference_based_detection(transcript, word_timestamps, reference_text)
        # Merge, avoid duplicating words already flagged by confidence
        flagged_words = {(i.word.lower(), round(i.timestamp, 1)) for i in issues}
        for ri in ref_issues:
            key = (ri.word.lower(), round(ri.timestamp, 1))
            if key not in flagged_words:
                issues.append(ri)
    else:
        # Layer 3: Phonetic pattern scanning (for free speech / CRAA)
        pattern_issues = _phonetic_pattern_detection(transcript, word_timestamps)
        flagged_words = {i.word.lower() for i in issues}
        for pi in pattern_issues:
            if pi.word.lower() not in flagged_words:
                issues.append(pi)

    return issues


def _confidence_based_detection(
    word_confidences: list,
) -> List[PronunciationIssue]:
    """
    Audio-level pronunciation detection using Whisper word confidence scores.

    Whisper's word-level probability reflects how well the audio matched
    the predicted text. Low confidence on common words strongly indicates
    pronunciation issues — the model heard something unusual.
    """
    issues = []
    if not word_confidences:
        return issues

    for wc in word_confidences:
        word = wc.get("word", "").strip()
        confidence = wc.get("confidence", 1.0)
        start = wc.get("start", 0.0)

        if not word or len(word) <= 1:
            continue

        clean = word.lower().strip(".,!?;:\"'()-")
        if not clean:
            continue

        # Determine threshold based on word category
        is_high_freq = clean in HIGH_FREQUENCY_WORDS
        is_academic = clean in ACADEMIC_WORDS

        if is_academic:
            # Academic words are harder; only flag if very low confidence
            threshold = CONF_LOW
            severity = "info"
        elif is_high_freq:
            # Common words should be pronounced clearly
            threshold = CONF_HIGH_FREQ_LOW
            severity = "warning"
        else:
            threshold = CONF_MEDIUM
            severity = "notice"

        if confidence < threshold:
            # Generate helpful feedback based on word characteristics
            tip = _generate_pronunciation_tip(clean, confidence, is_high_freq)
            issues.append(PronunciationIssue(
                word=clean,
                expected=tip,
                timestamp=start,
                confidence=round(1.0 - confidence, 2),  # Invert: higher = worse pronunciation
            ))

    return issues


def _generate_pronunciation_tip(word: str, confidence: float, is_common: bool) -> str:
    """Generate a helpful pronunciation tip based on the word and confidence level."""
    # Check if word is in our ESL issues database for a specific tip
    if word in COMMON_ESL_ISSUES:
        expected, ipa, tip = COMMON_ESL_ISSUES[word]
        if tip:
            return f"{expected} ({tip})"

    # Check for specific sound patterns in the word
    tips = []

    # th sounds
    if "th" in word:
        tips.append("Focus on the 'th' /θ/ or /ð/ sound — tongue tip between teeth")
    # r sounds
    if "r" in word and word not in ("or", "for", "are"):
        tips.append("Ensure clear 'r' articulation — curl tongue tip back")
    # v sounds
    if word.startswith("v") or "v" in word:
        tips.append("For 'v' — lightly bite lower lip and voice it")
    # Word endings with consonant clusters
    if word.endswith(("ld", "nd", "nk", "ngs", "sts", "sks", "lth")):
        tips.append(f"Pronounce the final consonant cluster in '{word}' clearly")
    # Multi-syllable stress
    if len(word) > 7:
        tips.append(f"Check word stress placement in '{word}'")

    if tips:
        return tips[0]

    if confidence < CONF_LOW:
        return f"Pronunciation unclear (ASR confidence: {confidence:.0%}) — practice saying '{word}' slowly and clearly"
    else:
        return f"Slightly unclear pronunciation — try emphasizing '{word}' more distinctly"


def _reference_based_detection(
    transcript: str,
    word_timestamps: list,
    reference_text: str,
) -> List[PronunciationIssue]:
    """Edit-distance based alignment for read-aloud exercises."""
    issues = []

    ref_words = reference_text.lower().strip().split()
    trans_words = transcript.lower().strip().split()

    ref_len = len(ref_words)
    trans_len = len(trans_words)

    dp = [[0] * (trans_len + 1) for _ in range(ref_len + 1)]
    for i in range(ref_len + 1):
        dp[i][0] = i
    for j in range(trans_len + 1):
        dp[0][j] = j

    for i in range(1, ref_len + 1):
        for j in range(1, trans_len + 1):
            if ref_words[i - 1] == trans_words[j - 1]:
                dp[i][j] = dp[i - 1][j - 1]
            else:
                dp[i][j] = 1 + min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])

    i, j = ref_len, trans_len
    operations = []
    while i > 0 or j > 0:
        if i > 0 and j > 0 and ref_words[i - 1] == trans_words[j - 1]:
            operations.append(("match", i - 1, j - 1))
            i -= 1
            j -= 1
        elif i > 0 and j > 0 and dp[i][j] == dp[i - 1][j - 1] + 1:
            operations.append(("substitute", i - 1, j - 1))
            i -= 1
            j -= 1
        elif j > 0 and dp[i][j] == dp[i][j - 1] + 1:
            operations.append(("insert", -1, j - 1))
            j -= 1
        elif i > 0 and dp[i][j] == dp[i - 1][j] + 1:
            operations.append(("delete", i - 1, -1))
            i -= 1

    operations.reverse()

    for op, ref_idx, trans_idx in operations:
        if op == "substitute":
            ts = word_timestamps[trans_idx] if trans_idx < len(word_timestamps) else {}
            issues.append(PronunciationIssue(
                word=trans_words[trans_idx],
                expected=ref_words[ref_idx],
                timestamp=ts.get("start", 0.0),
                confidence=0.7,
            ))
        elif op == "delete":
            issues.append(PronunciationIssue(
                word="(missing)",
                expected=ref_words[ref_idx],
                timestamp=0.0,
                confidence=0.5,
            ))

    return issues


def _phonetic_pattern_detection(
    transcript: str,
    word_timestamps: list,
) -> List[PronunciationIssue]:
    """
    Pattern-based detection for free speech.
    Scans transcript for words that commonly indicate ESL pronunciation issues.
    """
    issues = []
    if not transcript:
        return issues

    words = transcript.lower().strip().split()

    # Build a fast word→timestamp lookup
    ts_map = {}
    for idx, w in enumerate(words):
        if idx < len(word_timestamps):
            ts_map[idx] = word_timestamps[idx].get("start", 0.0)

    seen = set()

    for idx, word in enumerate(words):
        clean = word.strip(".,!?;:\"'()-")
        if not clean or clean in seen:
            continue

        if clean in COMMON_ESL_ISSUES:
            expected, ipa, tip = COMMON_ESL_ISSUES[clean]
            if expected and expected != clean and tip:
                issues.append(PronunciationIssue(
                    word=clean,
                    expected=f"{expected} ({tip})" if tip else expected,
                    timestamp=ts_map.get(idx, 0.0),
                    confidence=0.4,
                ))
                seen.add(clean)

    return issues


def calculate_pronunciation_score(
    transcript: str,
    reference_text: Optional[str],
    issues: List[PronunciationIssue],
    word_confidences: Optional[list] = None,
) -> float:
    """
    Calculate pronunciation score combining issue count and overall confidence.

    Enhanced scoring:
    - With reference: accuracy based on error ratio
    - Without reference + with confidence data: weighted average of word confidences
    - Without reference, no confidence: legacy pattern-based deduction
    """
    if reference_text:
        ref_words = reference_text.lower().strip().split()
        if not ref_words:
            return 75.0
        error_count = len(issues)
        accuracy = max(0, 1 - (error_count / len(ref_words)))
        return round(accuracy * 100, 1)

    if word_confidences:
        # Use actual audio confidence for scoring
        return _confidence_based_score(word_confidences, issues)

    # Fallback: pattern-based deduction
    if not issues:
        return 78.0
    deduction = min(len(issues) * 5, 30)
    return round(max(48.0, 78.0 - deduction), 1)


def _confidence_based_score(
    word_confidences: list,
    issues: List[PronunciationIssue],
) -> float:
    """
    Score pronunciation using Whisper word-level confidence distribution.

    The score considers:
    1. Mean confidence across all words (base score)
    2. Percentage of low-confidence words (penalty)
    3. Number of flagged pronunciation issues (additional penalty)
    """
    if not word_confidences:
        return 75.0

    confidences = []
    for wc in word_confidences:
        word = wc.get("word", "").strip()
        if len(word) <= 1:
            continue
        confidences.append(wc.get("confidence", 1.0))

    if not confidences:
        return 75.0

    import numpy as np
    conf_array = np.array(confidences)

    # Base score from mean confidence (mapped to 0-100 scale)
    mean_conf = float(np.mean(conf_array))
    # Map: 0.9+ → 90+, 0.7 → 70, 0.5 → 50
    base_score = mean_conf * 100

    # Penalty for low-confidence words
    low_conf_ratio = float(np.mean(conf_array < CONF_MEDIUM))
    low_conf_penalty = low_conf_ratio * 20  # Up to 20 points penalty

    # Penalty for flagged issues
    issue_penalty = min(len(issues) * 2, 15)  # Up to 15 points penalty

    # Bonus for consistency (low std = consistent pronunciation)
    conf_std = float(np.std(conf_array))
    consistency_bonus = max(0, (0.15 - conf_std) * 30)  # Up to ~4.5 bonus

    final_score = base_score - low_conf_penalty - issue_penalty + consistency_bonus
    final_score = max(30.0, min(100.0, final_score))

    logger.info(
        f"[pronunciation] Score: base={base_score:.1f}, low_penalty={low_conf_penalty:.1f}, "
        f"issue_penalty={issue_penalty}, consistency_bonus={consistency_bonus:.1f}, "
        f"final={final_score:.1f}"
    )

    return round(final_score, 1)


def analyze_pronunciation_audio(
    wav_path: str,
    word_timestamps: list,
    transcript: str,
) -> Dict:
    """
    Perform audio-level pronunciation analysis using Praat (parselmouth).

    Extracts per-word acoustic features:
    - Formant clarity (F1/F2 for vowel quality)
    - Intensity stability
    - Voice quality (jitter/shimmer for unclear speech)

    Returns a dict with audio_pronunciation_data to be included in LLM prompt.
    """
    try:
        import parselmouth
        from parselmouth.praat import call
    except ImportError:
        return {"available": False}

    try:
        sound = parselmouth.Sound(wav_path)
        total_duration = sound.get_total_duration()

        # Extract formants for vowel quality analysis
        formant = call(sound, "To Formant (burg)", 0.0, 5, 5500, 0.025, 50)

        # Extract voice quality metrics
        pitch = call(sound, "To Pitch", 0.0, 75, 600)
        point_process = call([sound, pitch], "To PointProcess (cc)")

        # Overall voice quality
        jitter = call(point_process, "Get jitter (local)", 0, 0, 0.0001, 0.02, 1.3)
        shimmer = call([sound, point_process], "Get shimmer (local)", 0, 0, 0.0001, 0.02, 1.3, 1.6)

        # Analyze intensity variability per word (for clarity assessment)
        word_clarity_data = []
        unclear_words = []

        for wt in word_timestamps:
            word = wt.get("word", "").strip()
            start = wt.get("start", 0)
            end = wt.get("end", 0)
            if not word or end <= start or len(word) <= 1:
                continue

            # Ensure we don't go beyond audio bounds
            start = max(0, min(start, total_duration - 0.01))
            end = min(end, total_duration)
            if end - start < 0.05:
                continue

            try:
                # Get intensity statistics for this word
                intensity = call(sound, "To Intensity", 75, 0.0)
                mean_int = call(intensity, "Get mean", start, end, "energy")
                std_int = call(intensity, "Get standard deviation", start, end)

                # Get F1 and F2 at midpoint (vowel quality indicator)
                mid_time = (start + end) / 2
                f1 = call(formant, "Get value at time", 1, mid_time, "Hertz", "Linear")
                f2 = call(formant, "Get value at time", 2, mid_time, "Hertz", "Linear")

                # Coefficient of variation of intensity (higher = less clear)
                clarity = std_int / mean_int if mean_int > 0 else 1.0

                word_clarity_data.append({
                    "word": word,
                    "start": start,
                    "intensity_mean": round(mean_int, 1) if mean_int else 0,
                    "intensity_cv": round(clarity, 3),
                    "f1": round(f1, 0) if f1 and f1 > 0 else None,
                    "f2": round(f2, 0) if f2 and f2 > 0 else None,
                })

                # Flag words with high intensity variation (unclear articulation)
                if clarity > 0.35 and len(word) > 2:
                    unclear_words.append(word)

            except Exception:
                continue

        # Calculate overall clarity score
        if word_clarity_data:
            cvs = [w["intensity_cv"] for w in word_clarity_data if w["intensity_cv"] > 0]
            avg_cv = sum(cvs) / len(cvs) if cvs else 0.3
            clarity_score = max(0, min(100, round((1 - min(avg_cv, 0.5) / 0.5) * 100)))
        else:
            clarity_score = 70

        return {
            "available": True,
            "jitter": round(jitter, 4) if jitter else 0,
            "shimmer": round(shimmer, 4) if shimmer else 0,
            "clarity_score": clarity_score,
            "unclear_words": unclear_words[:10],  # Limit to top 10
            "total_words_analyzed": len(word_clarity_data),
            "voice_quality": "clear" if jitter < 0.02 and shimmer < 0.1 else "slightly unclear" if jitter < 0.04 else "needs improvement",
        }

    except Exception as e:
        logger.warning(f"[pronunciation] Audio analysis failed: {e}")
        return {"available": False}
