from __future__ import annotations

import os
from pathlib import Path
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import declarative_base


BASE_DIR = Path(__file__).resolve().parent.parent  # repo root
DEFAULT_DB_PATH = BASE_DIR / "drumgen.db"
DATABASE_URL = os.getenv("DATABASE_URL") or f"sqlite+aiosqlite:///{DEFAULT_DB_PATH}"

engine = create_async_engine(DATABASE_URL, echo=False, future=True)
async_session_maker = async_sessionmaker(engine, expire_on_commit=False)

Base = declarative_base()


async def get_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        yield session

