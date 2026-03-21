"""
Pronunciation analysis service.

Two modes:
1. Reference-based: Compares transcript against reference text using edit distance
   (for read_aloud exercises with reference_text).
2. Phonetic-based: Detects commonly mispronounced words for ESL/EFL learners
   (for free_speech, qa, craa exercises without reference_text).
"""

from typing import List, Optional
from app.models.practice import PronunciationIssue

# ── Common pronunciation pitfalls for Cantonese/Mandarin L1 English learners ──
# Each entry: spoken_pattern → (expected, IPA hint, tip)
# These are patterns often detected by Whisper as substitutions.
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

# Commonly confused homophones / near-homophones that Whisper might transcribe wrong
WHISPER_LIKELY_SWAPS = {
    ("their", "there", "they're"),
    ("your", "you're"),
    ("its", "it's"),
    ("than", "then"),
    ("affect", "effect"),
    ("accept", "except"),
    ("lose", "loose"),
    ("quite", "quiet"),
    ("weather", "whether"),
}


def detect_pronunciation_issues(
    transcript: str,
    word_timestamps: list,
    reference_text: Optional[str] = None,
) -> List[PronunciationIssue]:
    """
    Detect pronunciation issues.

    1) If reference_text is provided: use edit-distance alignment (word-level).
    2) Always: scan for common ESL pronunciation patterns.
    """
    issues: List[PronunciationIssue] = []

    if reference_text:
        issues.extend(_reference_based_detection(transcript, word_timestamps, reference_text))
    else:
        # For free speech / CRAA — do phonetic pattern scanning
        issues.extend(_phonetic_pattern_detection(transcript, word_timestamps))

    return issues


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
    Uses low confidence since we're inferring from text, not audio waveform.
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

    seen = set()  # Avoid duplicates

    for idx, word in enumerate(words):
        # Strip common punctuation
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
                    confidence=0.4,  # Lower confidence — pattern-based
                ))
                seen.add(clean)

    return issues


def calculate_pronunciation_score(
    transcript: str,
    reference_text: Optional[str],
    issues: List[PronunciationIssue],
) -> float:
    """
    Calculate pronunciation score.
    - With reference: accuracy based on error ratio
    - Without reference: deduct from base score per detected issue
    """
    if reference_text:
        ref_words = reference_text.lower().strip().split()
        if not ref_words:
            return 75.0
        error_count = len(issues)
        accuracy = max(0, 1 - (error_count / len(ref_words)))
        return round(accuracy * 100, 1)
    else:
        # Free speech mode — start at 78, deduct per issue (max deduction 30)
        if not issues:
            return 78.0
        deduction = min(len(issues) * 5, 30)
        return round(max(48.0, 78.0 - deduction), 1)
