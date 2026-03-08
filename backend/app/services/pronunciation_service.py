from typing import List, Optional
from app.models.practice import PronunciationIssue


def detect_pronunciation_issues(
    transcript: str,
    word_timestamps: list,
    reference_text: Optional[str] = None,
) -> List[PronunciationIssue]:
    issues = []

    if not reference_text:
        return issues

    ref_words = reference_text.lower().strip().split()
    trans_words = transcript.lower().strip().split()

    ref_len = len(ref_words)
    trans_len = len(trans_words)
    n = max(ref_len, trans_len)

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
        if op == "substitute" and trans_idx < len(word_timestamps):
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


def calculate_pronunciation_score(
    transcript: str,
    reference_text: Optional[str],
    issues: List[PronunciationIssue],
) -> float:
    if not reference_text:
        return 75.0

    ref_words = reference_text.lower().strip().split()
    if not ref_words:
        return 75.0

    error_count = len(issues)
    accuracy = max(0, 1 - (error_count / len(ref_words)))
    return round(accuracy * 100, 1)
