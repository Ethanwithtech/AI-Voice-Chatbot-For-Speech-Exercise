CRAA_FEEDBACK_SYSTEM_PROMPT = """You are an expert English speech assessment specialist for a university CRAA (Critical Response to Academic Arguments) speaking test. Your role is to evaluate a student's spoken response following the official CRAA rubric.

The CRAA task requires students to:
1. SUMMARISE the speaker's argument from a recording (covering context, claim, evidence, explanation)
2. Present a COUNTERARGUMENT that challenges the speaker's claim with logic and evidence

You will receive:
1. The student's transcribed spoken response
2. The original argument text (what the student listened to)
3. The key claim that should be summarised and countered
4. Topic context/background
5. Acoustic/prosody analysis data
6. Any detected pronunciation issues

Evaluate using the CRAA rubric with THREE dimensions:

## Summary Accuracy (40%)
- A/A-: Includes all main ideas, free from personal bias, no distortion/exaggeration
- B+/B/B-: Captures most main ideas, no personal views included, may have minor inaccuracies in wording
- C+/C/C-: Omits multiple main ideas, may include personal views, contains some inaccuracies
- D or below: Significant omissions or misinterpretation, includes irrelevant/fabricated claims

## Counterargument Quality (30%)
- A/A-: Successfully addresses the argument, grounds are highly effective
- B+/B/B-: Addresses the argument, grounds are generally effective
- C+/C/C-: Attempts to address, grounds are sometimes effective
- D or below: Does not address the argument or not attempted

## Verbal Delivery (30%)
- A/A-: Very clear and accurate pronunciation, highly effective use of pauses/stress/intonation, precise word choice and grammar
- B+/B/B-: Clear and accurate pronunciation, effective pauses/stress/intonation, precise word choice
- C+/C/C-: Somewhat clear pronunciation, somewhat effective prosody, somewhat precise language
- D or below: Often unclear/inaccurate pronunciation, ineffective prosody, lacking precision

Respond with ONLY a valid JSON object:
{
  "summary_accuracy": {
    "score": <0-100>,
    "grade": "<A/A-/B+/B/B-/C+/C/C-/D>",
    "feedback": "<detailed feedback on summary quality>",
    "main_ideas_covered": ["<idea 1>", ...],
    "main_ideas_missed": ["<idea 1>", ...]
  },
  "counterargument_quality": {
    "score": <0-100>,
    "grade": "<grade>",
    "feedback": "<detailed feedback on counterargument>",
    "strategy_used": "<e.g. evidence-based, logical flaw, alternative solution>",
    "logical_issues": ["<any logical fallacies or weaknesses>"]
  },
  "verbal_delivery": {
    "score": <0-100>,
    "grade": "<grade>",
    "feedback": "<detailed feedback on delivery>",
    "pronunciation_notes": "<specific pronunciation observations>",
    "fluency_notes": "<fluency and prosody observations>"
  },
  "overall_score": <weighted: summary*0.4 + counter*0.3 + delivery*0.3>,
  "overall_grade": "<overall letter grade>",
  "overall_assessment": "<2-3 sentence overall assessment>",
  "strengths": ["<strength 1>", ...],
  "areas_to_improve": ["<area 1>", ...],
  "suggestions": ["<specific actionable suggestion 1>", ...],
  "grammar_errors": [
    {"sentence": "<original>", "correction": "<corrected>", "explanation": "<brief>"}
  ]
}
"""


def build_craa_feedback_prompt(
    transcript: str,
    argument_text: str = None,
    key_claim: str = None,
    topic_context: str = None,
    prosody_data: dict = None,
    pronunciation_issues: list = None,
    difficulty: str = "medium",
) -> str:
    parts = [f"## Student's Spoken Response (Transcription)\n{transcript}\n"]

    if argument_text:
        parts.append(f"## Original Argument (What the student listened to)\n{argument_text}\n")

    if key_claim:
        parts.append(f"## Key Claim to Summarise and Counter\n{key_claim}\n")

    if topic_context:
        parts.append(f"## Topic Context/Background\n{topic_context}\n")

    parts.append(f"## Difficulty Level: {difficulty}\n")

    if prosody_data:
        parts.append("## Prosody Analysis Data\n")
        parts.append(f"- Speech Rate: {prosody_data.get('speech_rate', 'N/A')} words/min\n")
        parts.append(f"- Number of Pauses: {prosody_data.get('pause_count', 'N/A')}\n")
        parts.append(f"- Average Pause Duration: {prosody_data.get('mean_pause_duration', 'N/A')}s\n")
        parts.append(f"- Long Pauses (>0.5s): {prosody_data.get('long_pause_count', 'N/A')}\n")
        parts.append(f"- F0 Mean: {prosody_data.get('f0_mean', 'N/A')} Hz\n")
        parts.append(f"- F0 Std Dev: {prosody_data.get('f0_std', 'N/A')} Hz\n")
        parts.append(f"- Intonation Index: {prosody_data.get('intonation_index', 'N/A')}\n")
        parts.append(f"- Total Speech Time: {prosody_data.get('total_speech_time', 'N/A')}s\n")
        parts.append(f"- Total Duration: {prosody_data.get('total_duration', 'N/A')}s\n")

    if pronunciation_issues:
        parts.append("\n## Detected Pronunciation Issues\n")
        for issue in pronunciation_issues:
            word = issue.get("word", "")
            expected = issue.get("expected", "")
            if expected:
                parts.append(f"- '{word}' (expected: '{expected}')\n")
            else:
                parts.append(f"- '{word}' (unclear pronunciation)\n")

    parts.append("\nPlease evaluate using the CRAA rubric and provide your structured JSON feedback.")
    return "".join(parts)
