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
- **Rebuild**: `cd frontend && npx vite build`

### Key Services
- **LLM**: Poe API (GPT-5 default, overridden to GPT-4o-Mini via env) for speech feedback
- **STT**: ElevenLabs API for speech-to-text
- **Audio Analysis**: praat-parselmouth for prosody analysis (with fallback when unavailable)

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-set by Replit)
- `POE_API_KEY` — Poe API key for LLM access
- `POE_BOT_NAME` — Poe bot name (GPT-4o-Mini)
- `JWT_SECRET` — JWT signing secret
- `ELEVENLABS_API_KEY` — ElevenLabs API key (optional, for STT)

## Startup
Single workflow: `cd backend && python -m uvicorn app.main:app --host 0.0.0.0 --port 5000`

## API Verification
- `GET /api/health` → `{"status": "ok", "message": "AI Speech Coach API is running"}`
- `POST /api/auth/teacher-login` with `{"email":"simonwang@hkbu.edu.hk","password":"admin123456"}` → returns JWT token

## Notes
- The `parselmouth` package in requirements.txt uses `praat-parselmouth` (the correct PyPI package name)
- prosody_service.py has a fallback mode when parselmouth is not available
- Admin user auto-created: simonwang@hkbu.edu.hk / admin123456
