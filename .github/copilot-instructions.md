# Bethesda Shelter Agent

AI-powered voice agent for Bethesda Mission Men's Shelter (108 beds).

## Tech Stack
- **Backend**: FastAPI (Python 3.11+)
- **Voice/SMS**: Twilio
- **AI**: OpenAI GPT-4o, Whisper, TTS
- **RAG**: Pinecone vector database
- **Database**: PostgreSQL (async via SQLAlchemy)
- **Background Jobs**: Celery + Redis

## Project Structure
```
src/
├── api/routes/         # FastAPI endpoints (voice, beds, reservations)
├── services/           # Business logic (voice_agent, intent_classifier, rag, bed, reservation)
├── models/             # SQLAlchemy models + Pydantic schemas
├── db/                 # Database connection and initialization
├── jobs/               # Celery background tasks
└── main.py             # FastAPI app entry point

tests/                  # Pytest test files
data/policies/          # Shelter policy documents for RAG
```

## Key Commands
```bash
# Run API server
uvicorn src.main:app --reload

# Run background workers
celery -A src.jobs.celery_app worker --beat --loglevel=info

# Run tests
pytest
```

## Environment Variables
Copy `.env.example` to `.env` and configure:
- `DATABASE_URL` - PostgreSQL connection
- `TWILIO_*` - Twilio credentials
- `OPENAI_API_KEY` - OpenAI API key
- `PINECONE_*` - Pinecone credentials
- `REDIS_URL` - Redis for Celery

## Core Business Rules
- 108 beds exactly (bed_id 1-108)
- Reservations hold for 3 hours, then auto-expire
- First-come-first-served, no favoritism
- Phone numbers hashed for privacy (SHA-256)
- Crisis detection takes priority in all interactions
