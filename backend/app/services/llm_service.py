import json
import asyncio
import logging
from typing import AsyncGenerator, Optional
import fastapi_poe as fp
from app.config import settings
from app.prompts.speech_feedback import SPEECH_FEEDBACK_SYSTEM_PROMPT, build_feedback_prompt
from app.prompts.craa_feedback import CRAA_FEEDBACK_SYSTEM_PROMPT, build_craa_prompt

logger = logging.getLogger(__name__)

# Simple token counter - rough estimate based on chars
_last_token_usage = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}


def get_last_token_usage() -> dict:
    return _last_token_usage.copy()


def _estimate_tokens(text: str) -> int:
    """Rough token estimate: ~4 chars per token for English."""
    return max(1, len(text) // 4)


async def _get_poe_response(messages: list[fp.ProtocolMessage]) -> tuple[str, dict]:
    """Get a complete response from Poe API. Returns (response_text, token_usage)."""
    global _last_token_usage
    response_text = ""
    async for partial in fp.get_bot_response(
        messages=messages,
        bot_name=settings.POE_BOT_NAME,
        api_key=settings.POE_API_KEY,
    ):
        response_text += partial.text

    prompt_text = " ".join(m.content for m in messages)
    prompt_tokens = _estimate_tokens(prompt_text)
    completion_tokens = _estimate_tokens(response_text)
    token_usage = {
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": prompt_tokens + completion_tokens,
    }
    _last_token_usage = token_usage.copy()
    logger.info(f"[LLM] Token usage estimate: prompt={prompt_tokens}, completion={completion_tokens}, total={prompt_tokens + completion_tokens}")

    return response_text, token_usage


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

    response_text, token_usage = await _get_poe_response(messages)

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


async def generate_craa_feedback(
    transcript: str,
    argument_text: str,
    topic_context: str = None,
    key_claim: str = None,
    prosody_data: dict = None,
    pronunciation_issues: list = None,
) -> dict:
    user_prompt = build_craa_prompt(
        transcript=transcript,
        argument_text=argument_text,
        topic_context=topic_context,
        key_claim=key_claim,
        prosody_data=prosody_data,
        pronunciation_issues=pronunciation_issues,
    )

    messages = [
        fp.ProtocolMessage(role="system", content=CRAA_FEEDBACK_SYSTEM_PROMPT),
        fp.ProtocolMessage(role="user", content=user_prompt),
    ]

    response_text, token_usage = await _get_poe_response(messages)

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
        feedback = {
            "overall_grade": 60,
            "overall_assessment": response_text,
            "summary_score": 60,
            "summary_feedback": "Unable to parse structured feedback.",
            "counterargument_score": 60,
            "counterargument_feedback": "Unable to parse structured feedback.",
            "delivery_score": 60,
            "delivery_feedback": "Unable to parse structured feedback.",
            "strengths": [],
            "areas_to_improve": [],
            "suggestions": ["Please try again for a more detailed analysis."],
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
