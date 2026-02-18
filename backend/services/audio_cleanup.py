"""
Utility functions for cleaning up orphaned audio files.
"""

import logging
import os
from pathlib import Path
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models import ModelTestResult, TestResult

PROJECT_ROOT = Path(__file__).resolve().parents[2]
AUDIO_DIR = PROJECT_ROOT / "audio_files"
logger = logging.getLogger(__name__)

async def cleanup_orphaned_audio_file(audio_id: str, session: AsyncSession) -> bool:
    """
    Delete an audio file if it's not linked to any result.
    
    Args:
        audio_id: The audio ID to check
        session: Database session
        
    Returns:
        True if file was deleted, False if it's still linked or doesn't exist
    """
    if not audio_id:
        return False
    
    # Check if this audio_id is still linked to any result
    result = await session.execute(
        select(TestResult).where(TestResult.audio_id == audio_id)
    )
    if result.scalar_one_or_none() is not None:
        logger.info("Skipping audio cleanup for %s: still linked to a result", audio_id)
        # Still linked to a result, don't delete
        return False
    
    # Not linked to any result, safe to delete
    audio_file_path = AUDIO_DIR / f"{audio_id}.wav"
    if audio_file_path.exists():
        try:
            os.remove(audio_file_path)
            logger.info("Deleted orphaned audio file %s", audio_file_path)
            return True
        except OSError:
            logger.exception("Failed to delete orphaned audio file %s", audio_file_path)
            return False
    
    return False


async def cleanup_all_orphaned_audio(session: AsyncSession) -> int:
    """
    Clean up all orphaned audio files (not linked to any result).
    
    Args:
        session: Database session
        
    Returns:
        Number of files deleted
    """
    if not AUDIO_DIR.exists():
        return 0
    
    # Get all audio_ids linked to classic LLM test results.
    llm_result = await session.execute(
        select(TestResult.audio_id).where(TestResult.audio_id.isnot(None))
    )
    linked_audio_ids = {row[0] for row in llm_result.fetchall()}
    # Also keep model-testing generated audio files.
    model_result = await session.execute(
        select(ModelTestResult.generated_audio_id).where(ModelTestResult.generated_audio_id.isnot(None))
    )
    linked_audio_ids.update(row[0] for row in model_result.fetchall())
    
    # Get all audio files
    audio_files = list(AUDIO_DIR.glob("*.wav"))

    logger.info(
        "Starting orphaned audio cleanup: files=%s linked_ids=%s",
        len(audio_files),
        len(linked_audio_ids),
    )
    
    deleted_count = 0
    deleted_names: list[str] = []
    for audio_file in audio_files:
        audio_id = audio_file.stem
        
        # If not linked to any result, delete it
        if audio_id not in linked_audio_ids:
            try:
                os.remove(audio_file)
                deleted_count += 1
                deleted_names.append(audio_file.name)
            except OSError:
                pass  # Ignore errors (file might be in use, etc.)
    if deleted_count:
        sample = ", ".join(deleted_names[:10])
        logger.info(
            "Deleted %s orphaned audio files%s",
            deleted_count,
            f" (first few: {sample})" if sample else "",
        )
    else:
        logger.info("No orphaned audio files to delete")
    
    return deleted_count
