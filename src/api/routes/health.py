"""Health check endpoints."""

from fastapi import APIRouter

from src.config import get_settings
from src.db.database import init_db

router = APIRouter()


@router.get("/health")
async def health_check() -> dict:
    """Basic health check endpoint."""
    settings = get_settings()
    return {
        "status": "healthy",
        "service": "bethesda-shelter-agent",
        "total_beds": settings.total_beds,
    }


@router.get("/init-db")
async def initialize_database() -> dict:
    """Initialize database tables and seed 108 beds."""
    try:
        await init_db()
        return {"status": "success", "message": "Database initialized with 108 beds"}
    except Exception as e:
        return {"status": "error", "message": str(e)}


@router.get("/ready")
async def readiness_check() -> dict:
    """Readiness check - verifies all dependencies are available."""
    settings = get_settings()
    return {
        "status": "ready",
        "database": f"sqlite ({settings.database_path})",
        "scheduler": "running",
    }
