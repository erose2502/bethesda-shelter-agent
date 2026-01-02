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

    # Database - SQLite (file path)
    database_path: str = "bethesda_shelter.db"
    
    @property
    def database_url(self) -> str:
        """SQLite connection URL for SQLAlchemy."""
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
