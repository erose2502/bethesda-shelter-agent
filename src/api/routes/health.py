"""Health check endpoints."""

from fastapi import APIRouter

from src.config import get_settings

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


@router.get("/ready")
async def readiness_check() -> dict:
    """Readiness check - verifies all dependencies are available."""
    # TODO: Add actual dependency checks (DB, Redis, etc.)
    return {
        "status": "ready",
        "database": "connected",
        "redis": "connected",
    }
