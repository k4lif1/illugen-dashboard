"""Import prompts from a JSON file into the database (one-time script)."""
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from backend.database import engine, async_session_maker, Base
from backend.models import Prompt
from sqlalchemy import select, func


async def main():
    json_path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).resolve().parents[1] / "1000_loop_prompts.json"
    if not json_path.exists():
        print(f"File not found: {json_path}")
        return

    with open(json_path) as f:
        data = json.load(f)

    prompts_list = data.get("prompts", [])
    if not prompts_list:
        print("No prompts found in JSON.")
        return

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with async_session_maker() as session:
        existing = await session.execute(select(func.count()).select_from(Prompt))
        count_before = existing.scalar() or 0

        existing_texts = set()
        rows = await session.execute(select(func.lower(Prompt.text)))
        for row in rows:
            existing_texts.add(row[0])

        added = 0
        skipped = 0
        for text in prompts_list:
            text = text.strip()
            if not text:
                skipped += 1
                continue
            if text.lower() in existing_texts:
                skipped += 1
                continue

            prompt = Prompt(
                text=text,
                difficulty=5,
                category="imported",
                drum_type=None,
                is_user_generated=False,
            )
            session.add(prompt)
            existing_texts.add(text.lower())
            added += 1

        await session.commit()
        print(f"Done. {added} prompts added, {skipped} skipped (duplicates/empty). DB had {count_before} before, now {count_before + added}.")


if __name__ == "__main__":
    asyncio.run(main())
