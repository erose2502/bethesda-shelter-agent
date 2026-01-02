"""Application configuration using Pydantic Settings."""

from functools import lru_cache
import os

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Frontend
    frontend_url: str = ""
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8",
        extra="ignore"  # Ignore extra env vars (e.g., old PINECONE, REDIS settings)
    )

    # App
    app_env: str = "development"
    debug: bool = False
    secret_key: str = "change-me-in-production"

    # Database - supports both PostgreSQL (production) and SQLite (local dev)
    database_url: str = ""  # PostgreSQL URL for production (e.g., postgresql+asyncpg://...)
    database_path: str = "bethesda_shelter.db"  # SQLite fallback for local dev
    
    @property
    def get_database_url(self) -> str:
        """Get database URL - prefers DATABASE_URL (Postgres) over DATABASE_PATH (SQLite)."""
        if self.database_url:
            # Ensure we use asyncpg for async support
            url = self.database_url
            if url.startswith("postgresql://"):
                url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
            return url
        return f"sqlite+aiosqlite:///{self.database_path}"

    # Twilio
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""

    # OpenAI
    openai_api_key: str = ""

    # ChromaDB - In-memory by default, or persistent path
    chromadb_persist_path: str = ""  # Empty = in-memory

    # Shelter Config
    total_beds: int = 108
    reservation_hold_hours: int = 3
    reservation_expire_check_minutes: int = 5

    # LiveKit
    livekit_url: str = ""
    livekit_api_key: str = ""
    livekit_api_secret: str = ""


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
