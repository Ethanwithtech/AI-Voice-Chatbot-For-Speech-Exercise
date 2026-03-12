import json
import logging
import traceback
from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Form
from fastapi.responses import Response
from typing import Optional, List
from app.database import get_db, Exercise, PracticeSession, PracticeResult, TokenUsage
from app.auth import get_current_user
from app.services.audio_service import save_upload, convert_to_wav, get_audio_duration, cleanup_files
from app.services.whisper_service import transcribe_audio
from app.services.prosody_service import analyze_prosody, evaluate_fluency
from app.services.pronunciation_service import detect_pronunciation_issues, calculate_pronunciation_score
from app.services.readaloud_service import detect_read_aloud
from app.services.llm_service import generate_feedback, generate_craa_feedback, get_last_token_usage

logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/analyze")
async def analyze_speech(
    audio: UploadFile = File(...),
    exercise_id: Optional[int] = Form(None),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("student", "admin", "teacher"):
        raise HTTPException(status_code=403, detail="Access denied")

    file_bytes = await audio.read()
    logger.info(f"[analyze] Received audio: size={len(file_bytes)}, content_type={audio.content_type}, exercise_id={exercise_id}")

    if len(file_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    # Strip content type parameters (e.g. audio/webm;codecs=opus → audio/webm)
    content_type_base = (audio.content_type or "").split(";")[0].strip()
    allowed_types = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/mp4"]
    if content_type_base and content_type_base not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {audio.content_type}")

    reference_text = None
    exercise_type = "free_speech"
    difficulty = "medium"

    upload_path = None
    wav_path = None
    db = get_db()
    try:
        if exercise_id:
            ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
            if ex:
                reference_text = ex.reference_text
                exercise_type = ex.exercise_type or "free_speech"
                difficulty = ex.difficulty or "medium"

        upload_path = save_upload(file_bytes, audio.filename or "audio.webm")
        wav_path = convert_to_wav(upload_path)
        logger.info(f"[analyze] Audio saved and converted to WAV")

        whisper_result = await transcribe_audio(wav_path)
        transcript = whisper_result["transcript"]
        word_timestamps = whisper_result["word_timestamps"]
        logger.info(f"[analyze] Transcription: {len(transcript)} chars, {len(word_timestamps)} words")

        if not transcript.strip():
            cleanup_files(upload_path, wav_path)
            raise HTTPException(status_code=400, detail="No speech detected in the audio")

        prosody = analyze_prosody(wav_path, word_timestamps)
        fluency_eval = evaluate_fluency(prosody)
        logger.info(f"[analyze] Prosody analyzed: speech_rate={prosody.speech_rate}")

        pronunciation_issues = detect_pronunciation_issues(transcript, word_timestamps, reference_text)
        pronunciation_score = calculate_pronunciation_score(transcript, reference_text, pronunciation_issues)

        is_read_aloud = detect_read_aloud(transcript, reference_text, prosody)

        prosody_data = prosody.dict()
        pron_issues_data = [i.dict() for i in pronunciation_issues]

        logger.info(f"[analyze] Generating LLM feedback...")
        llm_feedback = await generate_feedback(
            transcript=transcript,
            reference_text=reference_text,
            prosody_data=prosody_data,
            pronunciation_issues=pron_issues_data,
            exercise_type=exercise_type,
            difficulty=difficulty,
        )

        grammar_score = llm_feedback.get("score", 70)
        fluency_score = fluency_eval["fluency_score"]
        prosody_score = fluency_eval["prosody_score"]

        overall_score = round(
            grammar_score * 0.3 +
            fluency_score * 0.25 +
            pronunciation_score * 0.25 +
            prosody_score * 0.2
        )
        logger.info(f"[analyze] Scores: overall={overall_score}, grammar={grammar_score}, fluency={fluency_score}, pron={pronunciation_score}, prosody={prosody_score}")

        result = {
            "transcript": transcript,
            "word_timestamps": word_timestamps,
            "prosody": prosody_data,
            "pronunciation_issues": pron_issues_data,
            "is_read_aloud": is_read_aloud,
            "scores": {
                "overall": overall_score,
                "grammar": grammar_score,
                "fluency": fluency_score,
                "pronunciation": pronunciation_score,
                "prosody": prosody_score,
            },
            "errors": llm_feedback.get("grammar_errors", []),
            "suggestions": llm_feedback.get("suggestions", []),
            "strengths": llm_feedback.get("strengths", []),
            "areas_to_improve": llm_feedback.get("areas_to_improve", []),
            "llm_feedback": llm_feedback.get("overall_assessment", ""),
            "prosody_feedback": llm_feedback.get("prosody_feedback", ""),
            "pronunciation_feedback": llm_feedback.get("pronunciation_feedback", ""),
        }

        duration = get_audio_duration(upload_path)

        session = PracticeSession(
            student_id=current_user["id"],
            exercise_id=exercise_id,
            audio_data=file_bytes,
            audio_content_type=content_type_base or "audio/webm",
            transcript=transcript,
            duration_seconds=duration,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        practice_result = PracticeResult(
            session_id=session.id,
            overall_score=overall_score,
            grammar_score=grammar_score,
            fluency_score=fluency_score,
            pronunciation_score=pronunciation_score,
            prosody_score=prosody_score,
            speech_rate=prosody.speech_rate,
            pause_count=prosody.pause_count,
            mean_pause_duration=prosody.mean_pause_duration,
            f0_mean=prosody.f0_mean,
            f0_std=prosody.f0_std,
            intonation_index=prosody.intonation_index,
            is_read_aloud=is_read_aloud,
            llm_feedback=json.dumps(llm_feedback),
            errors=json.dumps(result["errors"]),
            suggestions=json.dumps(result["suggestions"]),
        )
        db.add(practice_result)
        db.commit()

        # Record token usage
        token_usage = get_last_token_usage()
        if token_usage["total_tokens"] > 0:
            usage_record = TokenUsage(
                user_id=current_user["id"],
                session_id=session.id,
                service="poe_llm",
                tokens_used=token_usage["total_tokens"],
                detail=json.dumps(token_usage),
            )
            db.add(usage_record)
            db.commit()

        cleanup_files(upload_path, wav_path)
        logger.info(f"[analyze] Analysis complete, session_id={session.id}")

        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[analyze] Analysis failed: {str(e)}")
        logger.error(traceback.format_exc())
        cleanup_files(upload_path, wav_path)
        raise HTTPException(status_code=500, detail="Analysis failed. Please try again.")
    finally:
        db.close()


@router.get("/history")
async def get_practice_history(current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        query = db.query(PracticeSession)

        if current_user["role"] == "student":
            query = query.filter(PracticeSession.student_id == current_user["id"])

        sessions = query.order_by(PracticeSession.created_at.desc()).limit(50).all()

        result = []
        for s in sessions:
            practice_result = None
            if s.results:
                pr = s.results[0]
                practice_result = {
                    "id": pr.id,
                    "overall_score": pr.overall_score,
                    "grammar_score": pr.grammar_score,
                    "fluency_score": pr.fluency_score,
                    "pronunciation_score": pr.pronunciation_score,
                    "prosody_score": pr.prosody_score,
                    "speech_rate": pr.speech_rate,
                    "pause_count": pr.pause_count,
                    "mean_pause_duration": pr.mean_pause_duration,
                    "f0_mean": pr.f0_mean,
                    "f0_std": pr.f0_std,
                    "intonation_index": pr.intonation_index,
                    "is_read_aloud": pr.is_read_aloud,
                    "llm_feedback": pr.llm_feedback,
                    "errors": pr.errors,
                    "suggestions": pr.suggestions,
                    "created_at": pr.created_at.isoformat() if pr.created_at else None,
                }

            exercise_title = None
            if s.exercise:
                exercise_title = s.exercise.title

            result.append({
                "id": s.id,
                "student_id": s.student_id,
                "exercise_id": s.exercise_id,
                "transcript": s.transcript,
                "duration_seconds": s.duration_seconds,
                "has_audio": s.audio_data is not None and len(s.audio_data) > 0,
                "created_at": s.created_at.isoformat() if s.created_at else None,
                "result": practice_result,
                "exercise_title": exercise_title,
            })

        return result
    finally:
        db.close()


@router.get("/session/{session_id}")
async def get_session_detail(session_id: int, current_user: dict = Depends(get_current_user)):
    db = get_db()
    try:
        session = db.query(PracticeSession).filter(PracticeSession.id == session_id).first()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if current_user["role"] == "student" and session.student_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        practice_result = None
        if session.results:
            pr = session.results[0]
            practice_result = {
                "id": pr.id,
                "overall_score": pr.overall_score,
                "grammar_score": pr.grammar_score,
                "fluency_score": pr.fluency_score,
                "pronunciation_score": pr.pronunciation_score,
                "prosody_score": pr.prosody_score,
                "speech_rate": pr.speech_rate,
                "pause_count": pr.pause_count,
                "mean_pause_duration": pr.mean_pause_duration,
                "f0_mean": pr.f0_mean,
                "f0_std": pr.f0_std,
                "intonation_index": pr.intonation_index,
                "is_read_aloud": pr.is_read_aloud,
                "llm_feedback": pr.llm_feedback,
                "errors": pr.errors,
                "suggestions": pr.suggestions,
                "created_at": pr.created_at.isoformat() if pr.created_at else None,
            }

        exercise_data = None
        if session.exercise:
            ex = session.exercise
            exercise_data = {
                "id": ex.id,
                "title": ex.title,
                "description": ex.description,
                "reference_text": ex.reference_text,
                "difficulty": ex.difficulty,
                "exercise_type": ex.exercise_type,
            }

        return {
            "id": session.id,
            "student_id": session.student_id,
            "exercise_id": session.exercise_id,
            "transcript": session.transcript,
            "duration_seconds": session.duration_seconds,
            "has_audio": session.audio_data is not None and len(session.audio_data) > 0,
            "created_at": session.created_at.isoformat() if session.created_at else None,
            "practice_results": [practice_result] if practice_result else [],
            "exercises": exercise_data,
        }
    finally:
        db.close()


@router.get("/session/{session_id}/audio")
async def get_session_audio(session_id: int, current_user: dict = Depends(get_current_user)):
    """Stream audio data for a practice session. Teachers can access any, students only their own."""
    db = get_db()
    try:
        session = db.query(PracticeSession).filter(PracticeSession.id == session_id).first()

        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        if current_user["role"] == "student" and session.student_id != current_user["id"]:
            raise HTTPException(status_code=403, detail="Access denied")

        if not session.audio_data:
            raise HTTPException(status_code=404, detail="No audio recording available")

        content_type = session.audio_content_type or "audio/webm"
        ext_map = {"audio/webm": ".webm", "audio/wav": ".wav", "audio/mp3": ".mp3", "audio/mpeg": ".mp3", "audio/ogg": ".ogg", "audio/mp4": ".mp4"}
        ext = ext_map.get(content_type, ".webm")
        return Response(
            content=session.audio_data,
            media_type=content_type,
            headers={"Content-Disposition": f"inline; filename=recording_{session_id}{ext}"},
        )
    finally:
        db.close()


@router.post("/craa-analyze")
async def analyze_craa_response(
    audio: UploadFile = File(...),
    exercise_id: int = Form(...),
    current_user: dict = Depends(get_current_user),
):
    if current_user["role"] not in ("student", "admin", "teacher"):
        raise HTTPException(status_code=403, detail="Access denied")

    file_bytes = await audio.read()
    logger.info(f"[craa-analyze] Received audio: size={len(file_bytes)}, exercise_id={exercise_id}")

    if len(file_bytes) > 50 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large (max 50MB)")

    content_type_base = (audio.content_type or "").split(";")[0].strip()
    allowed_types = ["audio/webm", "audio/wav", "audio/mp3", "audio/mpeg", "audio/ogg", "audio/mp4"]
    if content_type_base and content_type_base not in allowed_types:
        raise HTTPException(status_code=400, detail=f"Unsupported audio format: {audio.content_type}")

    upload_path = None
    wav_path = None
    db = get_db()
    try:
        ex = db.query(Exercise).filter(Exercise.id == exercise_id).first()
        if not ex:
            raise HTTPException(status_code=404, detail="Exercise not found")
        if ex.exercise_type != "craa":
            raise HTTPException(status_code=400, detail="Exercise is not a CRAA exercise")
        if not ex.argument_text:
            raise HTTPException(status_code=400, detail="Exercise has no argument text configured")

        upload_path = save_upload(file_bytes, audio.filename or "craa_response.webm")
        wav_path = convert_to_wav(upload_path)
        logger.info("[craa-analyze] Audio saved and converted to WAV")

        whisper_result = await transcribe_audio(wav_path)
        transcript = whisper_result["transcript"]
        word_timestamps = whisper_result["word_timestamps"]
        logger.info(f"[craa-analyze] Transcription: {len(transcript)} chars")

        if not transcript.strip():
            cleanup_files(upload_path, wav_path)
            raise HTTPException(status_code=400, detail="No speech detected in the audio")

        prosody = analyze_prosody(wav_path, word_timestamps)
        prosody_data = prosody.dict()

        logger.info("[craa-analyze] Generating CRAA LLM feedback...")
        craa_feedback = await generate_craa_feedback(
            transcript=transcript,
            argument_text=ex.argument_text,
            topic_context=ex.topic_context,
            key_claim=ex.key_claim,
            prosody_data=prosody_data,
        )

        overall_grade = craa_feedback.get("overall_grade", 60)
        summary_score = craa_feedback.get("summary_score", 60)
        counterargument_score = craa_feedback.get("counterargument_score", 60)
        delivery_score = craa_feedback.get("delivery_score", 60)

        logger.info(f"[craa-analyze] Scores: overall={overall_grade}, summary={summary_score}, counter={counterargument_score}, delivery={delivery_score}")

        duration = get_audio_duration(upload_path)

        session = PracticeSession(
            student_id=current_user["id"],
            exercise_id=exercise_id,
            audio_data=file_bytes,
            audio_content_type=content_type_base or "audio/webm",
            transcript=transcript,
            duration_seconds=duration,
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        practice_result = PracticeResult(
            session_id=session.id,
            overall_score=overall_grade,
            grammar_score=delivery_score,
            fluency_score=summary_score,
            pronunciation_score=counterargument_score,
            prosody_score=prosody_data.get("speech_rate", 0),
            speech_rate=prosody.speech_rate,
            pause_count=prosody.pause_count,
            mean_pause_duration=prosody.mean_pause_duration,
            f0_mean=prosody.f0_mean,
            f0_std=prosody.f0_std,
            intonation_index=prosody.intonation_index,
            is_read_aloud=False,
            llm_feedback=json.dumps(craa_feedback),
            errors=json.dumps([]),
            suggestions=json.dumps(craa_feedback.get("suggestions", [])),
        )
        db.add(practice_result)
        db.commit()

        token_usage = get_last_token_usage()
        if token_usage["total_tokens"] > 0:
            usage_record = TokenUsage(
                user_id=current_user["id"],
                session_id=session.id,
                service="poe_llm",
                tokens_used=token_usage["total_tokens"],
                detail=json.dumps(token_usage),
            )
            db.add(usage_record)
            db.commit()

        cleanup_files(upload_path, wav_path)
        logger.info(f"[craa-analyze] Complete, session_id={session.id}")

        return {
            "session_id": session.id,
            "transcript": transcript,
            "overall_grade": overall_grade,
            "summary_score": summary_score,
            "counterargument_score": counterargument_score,
            "delivery_score": delivery_score,
            "overall_assessment": craa_feedback.get("overall_assessment", ""),
            "summary_feedback": craa_feedback.get("summary_feedback", ""),
            "counterargument_feedback": craa_feedback.get("counterargument_feedback", ""),
            "delivery_feedback": craa_feedback.get("delivery_feedback", ""),
            "strengths": craa_feedback.get("strengths", []),
            "areas_to_improve": craa_feedback.get("areas_to_improve", []),
            "suggestions": craa_feedback.get("suggestions", []),
            "prosody": prosody_data,
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[craa-analyze] Failed: {str(e)}")
        logger.error(traceback.format_exc())
        cleanup_files(upload_path, wav_path)
        raise HTTPException(status_code=500, detail="CRAA analysis failed. Please try again.")
    finally:
        db.close()
