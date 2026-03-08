import json
from typing import AsyncGenerator, Optional
from openai import OpenAI
from app.config import settings
from app.prompts.speech_feedback import SPEECH_FEEDBACK_SYSTEM_PROMPT, build_feedback_prompt

client = OpenAI(
    api_key=settings.OPENROUTER_API_KEY,
    base_url=settings.OPENROUTER_BASE_URL,
)


async def generate_feedback(
    transcript: str,
    reference_text: Optional[str] = None,
    prosody_data: Optional[dict] = None,
    pronunciation_issues: Optional[list] = None,
    exercise_type: str = "free_speech",
    difficulty: str = "medium",
) -> dict:
    user_prompt = build_feedback_prompt(
        transcript=transcript,
        reference_text=reference_text,
        prosody_data=prosody_data,
        pronunciation_issues=pronunciation_issues,
        exercise_type=exercise_type,
        difficulty=difficulty,
    )

    response = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SPEECH_FEEDBACK_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=2000,
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    feedback = json.loads(content)
    return feedback


async def generate_feedback_stream(
    transcript: str,
    reference_text: Optional[str] = None,
    prosody_data: Optional[dict] = None,
    pronunciation_issues: Optional[list] = None,
    exercise_type: str = "free_speech",
    difficulty: str = "medium",
) -> AsyncGenerator[str, None]:
    user_prompt = build_feedback_prompt(
        transcript=transcript,
        reference_text=reference_text,
        prosody_data=prosody_data,
        pronunciation_issues=pronunciation_issues,
        exercise_type=exercise_type,
        difficulty=difficulty,
    )

    stream = client.chat.completions.create(
        model=settings.LLM_MODEL,
        messages=[
            {"role": "system", "content": SPEECH_FEEDBACK_SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt},
        ],
        temperature=0.7,
        max_tokens=2000,
        stream=True,
    )

    for chunk in stream:
        if chunk.choices[0].delta.content:
            yield chunk.choices[0].delta.content
