"""Seed the prompt database from user_prompts/curated_100.csv.

Clears ALL existing prompts, test results, and LLM failures first.

Usage:
    python seed_prompts.py
"""
import asyncio
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select, func, text
from backend.database import engine, async_session_maker, Base
from backend.models import Prompt, TestResult, LLMFailure

CSV_PATH = Path(__file__).resolve().parent / "user_prompts" / "curated_100.csv"


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        # Clear everything
        r1 = await session.execute(select(func.count(TestResult.id)))
        r2 = await session.execute(select(func.count(Prompt.id)))
        r3 = await session.execute(select(func.count(LLMFailure.id)))
        print(f"Clearing: {r1.scalar()} results, {r2.scalar()} prompts, {r3.scalar()} LLM failures")

        await session.execute(TestResult.__table__.delete())
        await session.execute(LLMFailure.__table__.delete())
        await session.execute(Prompt.__table__.delete())
        await session.commit()

        # Load CSV
        with open(CSV_PATH, newline="", encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        for row in rows:
            session.add(Prompt(
                text=row["text"].strip(),
                difficulty=5,
                is_user_generated=False,
            ))

        await session.commit()
        result = await session.execute(select(func.count(Prompt.id)))
        print(f"Done! Seeded {result.scalar()} prompts.")


if __name__ == "__main__":
    asyncio.run(seed())
