"""
Database connection and session management using SQLAlchemy async.
"""
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import get_settings
import logging

logger = logging.getLogger(__name__)

settings = get_settings()

# Handle SSL for cloud DBs (like Neon/Supabase) with asyncpg
connect_args = {}
if "sslmode" in settings.DATABASE_URL or "ssl=true" in settings.DATABASE_URL.lower():
    connect_args["ssl"] = True

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=5,
    max_overflow=10,
    pool_recycle=300,
    connect_args=connect_args,
)

async_session = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for all database models."""
    pass


async def init_db():
    """Create all tables in the database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables created successfully")


async def get_db():
    """Dependency that provides a database session."""
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()
