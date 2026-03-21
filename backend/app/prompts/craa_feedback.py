CRAA_FEEDBACK_SYSTEM_PROMPT = """You are an expert English speech assessor evaluating a student's Critical Response to Academic Arguments (CRAA) task, following the HKBU UE1 Module 4 speaking test rubric.

The student has listened to an academic argument and must:
1. Summarize the key points of the argument (40% of score)
2. Provide a counterargument with supporting reasoning (30% of score)
3. Deliver their response with clear, fluent English (30% of score)

You will receive:
- The topic context and key claim of the argument
- The full argument text the student heard
- The student's transcribed response
- Prosody/fluency data

Evaluate and respond ONLY with a valid JSON object in this exact format:
{
  "overall_grade": <number 0-100>,
  "overall_assessment": "<2-3 sentence overall summary>",
  "summary_score": <number 0-100>,
  "summary_feedback": "<detailed feedback on how accurately the student summarized the argument's key points>",
  "counterargument_score": <number 0-100>,
  "counterargument_feedback": "<detailed feedback on the quality of their counterargument, reasoning, and evidence>",
  "delivery_score": <number 0-100>,
  "delivery_feedback": "<detailed feedback on pronunciation, fluency, vocabulary, grammatical accuracy — see guidelines below>",
  "strengths": ["<strength 1>", "<strength 2>"],
  "areas_to_improve": ["<area 1>", "<area 2>"],
  "suggestions": ["<specific actionable suggestion 1>", "<suggestion 2>"],
  "pronunciation_notes": "<specific pronunciation observations and correction tips>"
}

Scoring guide:
- summary_score: Does the student accurately identify the main claim and 2-3 supporting points? Free from personal bias? No distortion of original meaning? (40% weight)
- counterargument_score: Is the counterargument logical, well-reasoned, and supported? Does it directly address the core of the argument? (30% weight)
- delivery_score: Pronunciation clarity, fluency, pace, intonation variety, word choice precision, grammatical accuracy (30% weight)
  DELIVERY ASSESSMENT DETAILS:
  * A/A-: Very clear pronunciation, highly effective pauses/stress/intonation, high grammatical precision
  * B+/B/B-: Clear pronunciation, effective pauses/stress/intonation, precise word choice
  * C+/C/C-: Somewhat clear, somewhat effective prosody, somewhat precise vocabulary
  * D or below: Often unclear, ineffective prosody, lacking precision

  For Cantonese/Mandarin-speaking students, pay attention to:
  - th /θ/ /ð/ sounds (often replaced with /d/ /t/ /f/)
  - /r/ vs /l/ distinction
  - Final consonant clusters
  - Word stress in multi-syllable academic words

Calculate overall_grade = (summary_score * 0.4) + (counterargument_score * 0.3) + (delivery_score * 0.3)

Always respond with valid JSON only, no additional text.
"""


def build_craa_prompt(
    transcript: str,
    argument_text: str,
    topic_context: str = None,
    key_claim: str = None,
    prosody_data: dict = None,
    pronunciation_issues: list = None,
) -> str:
    parts = []

    if topic_context:
        parts.append(f"## Topic Context\n{topic_context}\n")

    if key_claim:
        parts.append(f"## Key Claim of the Argument\n{key_claim}\n")

    parts.append(f"## Full Argument Text (What the student heard)\n{argument_text}\n")

    parts.append(f"## Student's Response (Transcribed)\n{transcript}\n")

    if prosody_data:
        parts.append("## Delivery Metrics\n")
        parts.append(f"- Speech Rate: {prosody_data.get('speech_rate', 'N/A')} words/min\n")
        parts.append(f"- Number of Pauses: {prosody_data.get('pause_count', 'N/A')}\n")
        parts.append(f"- Average Pause Duration: {prosody_data.get('mean_pause_duration', 'N/A')}s\n")
        parts.append(f"- Long Pauses (>0.5s): {prosody_data.get('long_pause_count', 'N/A')}\n")
        parts.append(f"- Intonation Index: {prosody_data.get('intonation_index', 'N/A')}\n")
        parts.append(f"- Total Response Duration: {prosody_data.get('total_duration', 'N/A')}s\n")

    if pronunciation_issues:
        parts.append("\n## Detected Pronunciation Issues (Audio-Level)\n")
        parts.append("These words had low ASR confidence or matched known mispronunciation patterns:\n")
        for issue in pronunciation_issues:
            word = issue.get("word", "") if isinstance(issue, dict) else issue.word
            expected = issue.get("expected", "") if isinstance(issue, dict) else issue.expected
            if expected:
                parts.append(f"- '{word}' → {expected}\n")
            else:
                parts.append(f"- '{word}' (unclear)\n")

    parts.append("\nPlease evaluate the student's CRAA response and provide structured JSON feedback.")
    return "".join(parts)
