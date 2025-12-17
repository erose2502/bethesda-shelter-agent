"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from typing import AsyncGenerator

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.config import get_settings
from src.api.routes import voice, reservations, beds, health
from src.db.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    """Application lifespan handler for startup/shutdown."""
    # Startup
    settings = get_settings()
    print("🚀 Starting Bethesda Shelter Agent...")
    print(f"   Total beds configured: {settings.total_beds}")
    
    # Try to init database, but don't crash if it fails
    try:
        await init_db()
        print("✅ Database connected")
    except Exception as e:
        print(f"⚠️ Database init failed (will retry on first request): {e}")
    
    yield
    
    # Shutdown
    print("👋 Shutting down Bethesda Shelter Agent...")


def create_app() -> FastAPI:
    """Create and configure the FastAPI application."""
    settings = get_settings()

    app = FastAPI(
        title="Bethesda Shelter Agent",
        description="AI Voice Agent for Men's Shelter - 108 Bed Management System",
        version="0.1.0",
        lifespan=lifespan,
        debug=settings.debug,
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            settings.frontend_url if getattr(settings, 'frontend_url', None) else "*",
            "http://localhost:5173",
            "http://localhost:5174",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Include routers
    app.include_router(health.router, tags=["Health"])
    app.include_router(voice.router, prefix="/api/voice", tags=["Voice"])
    app.include_router(reservations.router, prefix="/api/reservations", tags=["Reservations"])
    app.include_router(beds.router, prefix="/api/beds", tags=["Beds"])

    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("src.main:app", host="0.0.0.0", port=8000, reload=True)
