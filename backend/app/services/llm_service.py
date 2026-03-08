import json
import asyncio
from typing import AsyncGenerator, Optional
import fastapi_poe as fp
from app.config import settings
from app.prompts.speech_feedback import SPEECH_FEEDBACK_SYSTEM_PROMPT, build_feedback_prompt


async def _get_poe_response(messages: list[fp.ProtocolMessage]) -> str:
    """Get a complete response from Poe API."""
    response_text = ""
    async for partial in fp.get_bot_response(
        messages=messages,
        bot_name=settings.POE_BOT_NAME,
        api_key=settings.POE_API_KEY,
    ):
        response_text += partial.text
    return response_text


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

    messages = [
        fp.ProtocolMessage(role="system", content=SPEECH_FEEDBACK_SYSTEM_PROMPT),
        fp.ProtocolMessage(role="user", content=user_prompt),
    ]

    response_text = await _get_poe_response(messages)

    # Try to parse JSON from the response
    # Sometimes LLM wraps JSON in markdown code blocks
    text = response_text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()

    try:
        feedback = json.loads(text)
    except json.JSONDecodeError:
        # If JSON parsing fails, return a basic structure
        feedback = {
            "overall_assessment": response_text,
            "score": 70,
            "grammar_errors": [],
            "suggestions": ["Please try again for a more detailed analysis."],
            "strengths": [],
            "areas_to_improve": [],
            "prosody_feedback": "",
            "pronunciation_feedback": "",
        }

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

    messages = [
        fp.ProtocolMessage(role="system", content=SPEECH_FEEDBACK_SYSTEM_PROMPT),
        fp.ProtocolMessage(role="user", content=user_prompt),
    ]

    async for partial in fp.get_bot_response(
        messages=messages,
        bot_name=settings.POE_BOT_NAME,
        api_key=settings.POE_API_KEY,
    ):
        if partial.text:
            yield partial.text
