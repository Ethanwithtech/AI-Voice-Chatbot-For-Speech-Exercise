# AI Voice Chatbot for Speech Exercise

## Overview
AI-powered speech practice and assessment platform for HKBU. Students can practice speaking exercises with AI feedback on pronunciation, grammar, fluency, and prosody. Teachers can create exercises and manage students.

## Architecture

### Backend (backend/)
- **Framework**: Python FastAPI + Uvicorn
- **Port**: 5000 (0.0.0.0)
- **Database**: PostgreSQL via SQLAlchemy (reads `DATABASE_URL` env var)
- **API prefix**: `/api/auth`, `/api/exercises`, `/api/practice`, `/api/users`, `/api/health`
- **Static serving**: Serves built frontend from `frontend/dist/` using SPA catch-all (assets mounted at `/assets`, all other non-API routes serve `index.html`)
- **Auto-init**: Creates database tables and admin user on startup

### Frontend (frontend/)
- **Framework**: React 18 + TypeScript + Vite
- **UI**: Tailwind CSS + shadcn/ui
- **Build output**: `frontend/dist/` (served by backend)
- **Rebuild**: `cd frontend && npm install && npm run build`
- **Note**: Requires `@types/node` dev dependency for TypeScript build

### Key Services
- **LLM**: Poe API (GPT-4o-Mini) for speech feedback, with token usage tracking
- **STT**: Dual-engine — ElevenLabs Scribe v2 (if API key set) or local OpenAI Whisper (free fallback)
- **Audio Analysis**: praat-parselmouth for prosody analysis (with fallback when unavailable)
- **Audio Storage**: Student recordings saved as binary data in `practice_sessions.audio_data`

### Database Tables
- `users` — students and teachers/admins
- `exercises` — practice exercises with reference text
- `practice_sessions` — session records with transcript, duration, audio_data (binary), audio_content_type
- `practice_results` — scores, prosody metrics, LLM feedback per session
- `token_usage` — tracks estimated token usage per LLM API call

### Key API Endpoints
- `GET /api/health` — health check with STT engine info
- `GET /api/debug-headers` — temporary diagnostic endpoint (returns request headers, URL, client IP). Remove after debugging deployment issues.
- `POST /api/auth/teacher-login` — teacher/admin login
- `POST /api/practice/analyze` — upload audio, get speech analysis
- `GET /api/practice/session/{id}/audio` — stream back recorded audio for playback
- `GET /api/practice/history` — list practice sessions
- `GET /api/users/token-stats` — total tokens, sessions, students, recent usage

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `POE_API_KEY` — Poe API key for LLM access
- `POE_BOT_NAME` — Poe bot name (GPT-4o-Mini)
- `JWT_SECRET` — JWT signing secret
- `ELEVENLABS_API_KEY` — ElevenLabs API key (optional; without it, uses local Whisper)
- `STT_ENGINE` — `auto` (default), `elevenlabs`, or `whisper_local`
- `WHISPER_MODEL_SIZE` — Whisper model size: `tiny` (75MB), `base` (139MB, current), `small`, `medium`

## Startup
Single workflow: `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 5000`

## API Verification
- `GET /api/health` → `{"status":"ok","stt_engine":"whisper_local"}` (or `"elevenlabs"` if key set)
- `POST /api/auth/teacher-login` with `{"email":"simonwang@hkbu.edu.hk","password":"admin123456"}` → returns JWT token
- `GET /api/users/token-stats` → `{"total_tokens":0,"total_sessions":N,"total_students":N,...}`

## Dependencies
- Python: torch (CPU-only, v2.1.2+cpu), openai-whisper (v20250625), praat-parselmouth, fastapi, etc.
- Node: React 18, Vite 5, Tailwind CSS, shadcn/ui, @types/node
- System: ffmpeg (for audio processing)

## Notes
- The `openai-whisper==20240930` pin in requirements.txt fails due to pkg_resources; v20250625 installed instead (compatible). requirements.txt now uses `>=20240930`.
- torch installed as CPU-only variant to save space (~185MB vs ~2GB GPU version)
- prosody_service.py has a fallback mode when parselmouth is not available
- Admin user auto-created: simonwang@hkbu.edu.hk / admin123456
- `logging.basicConfig(level=logging.INFO)` added to main.py so app-level logger output appears in uvicorn logs
- Content type validation strips parameters (e.g., `audio/webm;codecs=opus` → `audio/webm`) before checking allowed types
