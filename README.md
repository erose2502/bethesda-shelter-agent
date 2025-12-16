# Bethesda Shelter Agent

AI-powered voice agent for Bethesda Mission Men's Shelter - managing 108 beds with fairness, reliability, and compassion.

## Overview

This system provides 24/7 automated phone support for shelter operations:
- **Bed availability inquiries** - Real-time status of 108 beds
- **Reservations** - Fair, first-come-first-served bed holds (3-hour expiration)
- **Shelter information** - Rules, curfew times, requirements via RAG
- **Crisis detection** - Automatic flagging and appropriate responses
- **Staff dashboard** - Real-time monitoring and daily summaries

## Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Voice/SMS | Twilio | 24/7 inbound calls, SMS confirmations |
| Speech-to-Text | OpenAI Whisper | Accurate transcription, handles distressed speech |
| Text-to-Speech | OpenAI TTS | Natural, calm voice |
| LLM | GPT-4o | Intent classification, response generation |
| RAG | Pinecone | Shelter-specific policy retrieval |
| Database | PostgreSQL | Bed & reservation state (108 rows) |
| Backend | FastAPI | Async API, Twilio webhooks |
| Jobs | Celery + Redis | Reservation expiration, cleanup |

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL
- Redis
- Twilio account
- OpenAI API key
- Pinecone account (optional, has fallbacks)

### Setup

1. **Clone and install dependencies**
   ```bash
   cd bethesda-shelter-agent
   pip install -e ".[dev]"
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env
   # Edit .env with your credentials
   ```

3. **Initialize database**
   ```bash
   # Start PostgreSQL, then:
   python -c "from src.db.database import init_db; import asyncio; asyncio.run(init_db())"
   ```

4. **Run the server**
   ```bash
   uvicorn src.main:app --reload
   ```

5. **Start background workers** (separate terminal)
   ```bash
   celery -A src.jobs.celery_app worker --beat --loglevel=info
   ```

### Twilio Configuration

Point your Twilio phone number webhooks to:
- **Voice URL**: `https://your-domain.com/api/voice/incoming` (POST)
- **Status Callback**: `https://your-domain.com/api/voice/status` (POST)

## API Endpoints

### Health
- `GET /health` - Basic health check
- `GET /ready` - Readiness with dependency status

### Voice (Twilio Webhooks)
- `POST /api/voice/incoming` - Handle incoming calls
- `POST /api/voice/process` - Process speech input
- `POST /api/voice/transfer` - Transfer to staff

### Beds
- `GET /api/beds/` - Bed summary (available/held/occupied)
- `GET /api/beds/available` - Available count
- `POST /api/beds/{id}/checkin` - Check in guest
- `POST /api/beds/{id}/checkout` - Check out guest

### Reservations
- `POST /api/reservations/` - Create reservation
- `GET /api/reservations/{id}` - Get reservation status
- `POST /api/reservations/{id}/cancel` - Cancel reservation
- `GET /api/reservations/` - List active (staff)

## Database Schema

### beds (108 rows, never more)
```sql
bed_id INT PRIMARY KEY  -- 1-108
status ENUM('available', 'held', 'occupied')
```

### reservations
```sql
reservation_id UUID PRIMARY KEY
caller_hash TEXT  -- SHA-256 hashed phone (privacy)
bed_id INT FOREIGN KEY
expires_at TIMESTAMP  -- 3-hour hold
status ENUM('active', 'expired', 'checked_in', 'cancelled')
```

## Reservation Rules (Enforced)

1. **First-come, first-served** - No favoritism
2. **3-hour hold** - Auto-expires if not checked in
3. **No double booking** - One reservation per caller
4. **Privacy-first** - Phone numbers are hashed

## Project Structure

```
src/
├── api/routes/        # FastAPI endpoints
│   ├── voice.py       # Twilio webhooks
│   ├── beds.py        # Bed management
│   └── reservations.py
├── services/          # Business logic
│   ├── voice_agent.py # Main orchestrator
│   ├── intent_classifier.py  # GPT-4 intent detection
│   ├── rag_service.py # Policy retrieval
│   ├── bed_service.py
│   └── reservation_service.py
├── models/            # SQLAlchemy + Pydantic
├── db/                # Database setup
├── jobs/              # Celery background tasks
└── main.py            # FastAPI app
```

## Testing

```bash
# Run all tests
pytest

# With coverage
pytest --cov=src

# Specific test file
pytest tests/test_bed_service.py
```

## Deployment Checklist

- [ ] Set all production environment variables
- [ ] Configure PostgreSQL with proper connection pooling
- [ ] Set up Redis for Celery
- [ ] Configure Twilio webhooks with HTTPS
- [ ] Enable CORS only for dashboard domain
- [ ] Set up monitoring/alerting
- [ ] Load shelter policies into Pinecone
- [ ] Test crisis detection flow
- [ ] Train staff on dashboard

## Security & Privacy

- **No names stored** - Callers identified only by hashed phone
- **No voice recordings** by default
- **Auto-cleanup** - Old data deleted after 30 days
- **HTTPS required** for all production endpoints

## Cost Estimates (Monthly)

| Service | Estimate |
|---------|----------|
| Twilio (1000 calls) | ~$150 |
| OpenAI (GPT-4o + Whisper) | ~$100-200 |
| Pinecone (Starter) | $0-70 |
| Hosting (basic) | ~$50 |
| **Total** | **~$300-500/mo** |

## Support

For issues or questions, contact the development team.

---

Built with 💙 for Bethesda Mission
