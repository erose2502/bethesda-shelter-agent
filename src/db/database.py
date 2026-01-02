"""Database connection and session management - supports PostgreSQL and SQLite."""

from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import declarative_base

from src.config import get_settings

# Create base class for models
Base = declarative_base()

# Engine and session factory (initialized lazily)
_engine = None
_async_session_factory = None


def get_engine():
    """Get or create the async database engine (PostgreSQL or SQLite)."""
    global _engine
    if _engine is None:
        settings = get_settings()
        db_url = settings.get_database_url
        
        # Configure engine based on database type
        if "sqlite" in db_url:
            _engine = create_async_engine(
                db_url,
                echo=settings.debug,
                connect_args={"check_same_thread": False},
            )
        else:
            # PostgreSQL
            _engine = create_async_engine(
                db_url,
                echo=settings.debug,
                pool_pre_ping=True,
                pool_size=5,
                max_overflow=10,
            )
    return _engine


def get_session_factory():
    """Get or create the async session factory."""
    global _async_session_factory
    if _async_session_factory is None:
        _async_session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _async_session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """
    Dependency for FastAPI routes to get a database session.
    
    Usage:
        @router.get("/")
        async def my_route(db: AsyncSession = Depends(get_db)):
            ...
    """
    factory = get_session_factory()
    async with factory() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def init_db() -> None:
    """
    Initialize database tables.
    
    In production, use Alembic migrations instead.
    This is for development/testing.
    """
    engine = get_engine()
    
    # Import models to ensure they're registered with Base
    from src.models import db_models  # noqa: F401
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    # Initialize 108 beds if they don't exist
    await init_beds()


async def init_beds() -> None:
    """
    Initialize exactly 108 beds if they don't exist.
    
    This should only run once on first startup.
    """
    from src.models.db_models import Bed, BedStatus
    from sqlalchemy import select
    
    factory = get_session_factory()
    async with factory() as session:
        # Check if beds already exist
        result = await session.execute(select(Bed).limit(1))
        if result.scalar_one_or_none() is not None:
            return  # Beds already initialized
        
        # Create exactly 108 beds
        beds = [
            Bed(bed_id=i, status=BedStatus.AVAILABLE)
            for i in range(1, 109)  # 1 to 108
        ]
        session.add_all(beds)
        await session.commit()
        
        settings = get_settings()
        if settings.debug:
            print(f"✅ Initialized {len(beds)} beds")
