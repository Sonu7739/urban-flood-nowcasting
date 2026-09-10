import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

env_db = os.environ.get("DATABASE_URL")

if env_db and "postgresql" in env_db:
    DATABASE_URL = env_db.replace("postgresql://", "postgresql+asyncpg://")
else:
    # Fallback to SQLite (works out of the box anywhere without requiring a running Postgres server)
    DATABASE_URL = "sqlite+aiosqlite:///./ufns.db"

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
