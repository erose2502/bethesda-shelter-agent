# Bethesda Shelter Agent

AI-powered voice agent for Bethesda Mission Men's Shelter (108 beds).

## Tech Stack
- **Backend**: FastAPI (Python 3.11+)
- **Voice Pipeline**: LiveKit Agents + Twilio SIP
- **AI**: OpenAI GPT-4o-mini, Whisper STT, TTS
- **RAG**: ChromaDB (in-memory)
- **Database**: SQLite (via aiosqlite)
- **Background Jobs**: APScheduler (in-process)

## Project Structure
```
src/
├── api/routes/         # FastAPI endpoints (voice, beds, reservations)
├── services/           # Business logic (voice_agent, intent_classifier, rag, bed, reservation)
├── models/             # SQLAlchemy models + Pydantic schemas
├── db/                 # Database connection and initialization
├── jobs/               # APScheduler background tasks
├── livekit_agent.py    # LiveKit voice agent worker
└── main.py             # FastAPI app entry point

tests/                  # Pytest test files
data/policies/          # Shelter policy documents for RAG
```

## Key Commands
```bash
# Run API server
uvicorn src.main:app --reload

# Run LiveKit voice agent worker
python src/livekit_agent.py start

# Run tests
pytest
```

## Environment Variables
Copy `.env.example` to `.env` and configure:
- `DATABASE_PATH` - SQLite database file path
- `TWILIO_*` - Twilio credentials
- `OPENAI_API_KEY` - OpenAI API key
- `LIVEKIT_*` - LiveKit credentials
- `CHROMADB_PERSIST_PATH` - Optional, leave empty for in-memory

## Core Business Rules
- 108 beds exactly (bed_id 1-108)
- Reservations hold for 3 hours, then auto-expire
- First-come-first-served, no favoritism
- Phone numbers hashed for privacy (SHA-256)
- Crisis detection takes priority in all interactions
