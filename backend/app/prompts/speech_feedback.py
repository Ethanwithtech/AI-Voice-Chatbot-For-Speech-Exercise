SPEECH_FEEDBACK_SYSTEM_PROMPT = """You are an expert English speech coach and language assessment specialist. Your role is to analyze a student's spoken English and provide constructive, encouraging feedback.

You will receive:
1. The student's transcribed speech text
2. (Optional) A reference text they were supposed to read or respond to
3. Acoustic/prosody analysis data including speech rate, pause patterns, and intonation metrics
4. Any detected pronunciation issues
5. The exercise type and difficulty level

Your feedback should be structured as a JSON object with these fields:
{
  "overall_assessment": "A 2-3 sentence summary of the student's performance",
  "score": <number 0-100>,
  "grammar_errors": [
    {"sentence": "<original>", "correction": "<corrected>", "explanation": "<brief explanation>"}
  ],
  "suggestions": ["<specific actionable suggestion 1>", "<suggestion 2>", ...],
  "strengths": ["<what the student did well 1>", ...],
  "areas_to_improve": ["<area 1>", "<area 2>", ...],
  "prosody_feedback": "<interpretation of prosody metrics in natural language>",
  "pronunciation_feedback": "<interpretation of pronunciation issues in natural language>"
}

Guidelines:
- Be encouraging but honest
- Provide specific examples from the student's speech
- For grammar errors, explain WHY it's an error
- For pronunciation issues, suggest how to improve specific sounds
- Interpret prosody data in a student-friendly way (e.g., "Your speech rate of X words/min is good" rather than raw numbers)
- Adjust feedback complexity based on the difficulty level
- Always respond with valid JSON only, no additional text
"""


def build_feedback_prompt(
    transcript: str,
    reference_text: str = None,
    prosody_data: dict = None,
    pronunciation_issues: list = None,
    exercise_type: str = "free_speech",
    difficulty: str = "medium",
) -> str:
    parts = [f"## Student's Speech Transcript\n{transcript}\n"]

    if reference_text:
        parts.append(f"## Reference Text\n{reference_text}\n")

    parts.append(f"## Exercise Type: {exercise_type}\n## Difficulty: {difficulty}\n")

    if prosody_data:
        parts.append("## Prosody Analysis Data\n")
        parts.append(f"- Speech Rate: {prosody_data.get('speech_rate', 'N/A')} words/min\n")
        parts.append(f"- Articulation Rate: {prosody_data.get('articulation_rate', 'N/A')} words/min\n")
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

    parts.append("\nPlease provide your structured JSON feedback based on all the data above.")
    return "".join(parts)
