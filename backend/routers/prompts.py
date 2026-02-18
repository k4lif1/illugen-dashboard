from __future__ import annotations

import logging
import random
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Prompt, PromptCreate, PromptRead, TestResult

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/", response_model=List[PromptRead], summary="List prompts")
async def list_prompts(
    session: AsyncSession = Depends(get_session),
    difficulty_min: int = Query(1, ge=1, le=10),
    difficulty_max: int = Query(10, ge=1, le=10),
    drum_type: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    limit: int = Query(50, ge=1, le=5000),
    offset: int = Query(0, ge=0),
) -> List[PromptRead]:
    stmt = select(Prompt).where(Prompt.difficulty.between(difficulty_min, difficulty_max))
    if drum_type:
        stmt = stmt.where(Prompt.drum_type == drum_type)
    if category:
        stmt = stmt.where(Prompt.category == category)
    if search:
        like = f"%{search.lower()}%"
        stmt = stmt.where(Prompt.text.ilike(like))
    stmt = stmt.order_by(Prompt.id.desc()).limit(limit).offset(offset)
    result = await session.execute(stmt)
    prompts = result.scalars().all()
    return [PromptRead.model_validate(p) for p in prompts]


@router.post("/", response_model=PromptRead, status_code=status.HTTP_201_CREATED, summary="Create prompt")
async def create_prompt(payload: PromptCreate, session: AsyncSession = Depends(get_session)) -> PromptRead:
    # Check for duplicates if this is NOT a user-generated prompt
    if not payload.is_user_generated:
        # Check if a prompt with the same text (case-insensitive) already exists
        from sqlalchemy import func
        existing = await session.execute(
            select(Prompt).where(
                func.lower(Prompt.text) == func.lower(payload.text),
                Prompt.is_user_generated == False
            )
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A prompt with this text already exists. Duplicates are not allowed for pre-generated prompts."
            )
    
    prompt = Prompt(
        text=payload.text,
        difficulty=payload.difficulty,
        category=payload.category,
        drum_type=payload.drum_type,
        is_user_generated=payload.is_user_generated,
        expected_parameters=payload.expected_parameters,
    )
    session.add(prompt)
    await session.commit()
    await session.refresh(prompt)
    return PromptRead.model_validate(prompt)


@router.get("/next-in-rotation", response_model=PromptRead, summary="Get next prompt in rotation")
async def get_next_prompt_in_rotation(
    current_drum_type: Optional[str] = None,
    current_difficulty: Optional[int] = None,
    exclude_id: Optional[int] = None,
    start_from_beginning: bool = False,
    session: AsyncSession = Depends(get_session)
) -> PromptRead:
    """
    Get the next prompt in rotation based on:
    1. Cycle through difficulties 1-10 for one drum type
    2. Move to next drum type, repeat 1-10
    3. Prefer prompts with lower used_count
    4. Only non-user-generated prompts
    5. Exclude a specific prompt ID to avoid repeats when skipping
    6. If start_from_beginning=True, always start from first drum type at difficulty 1
    """
    # Get all drum types ordered alphabetically
    drum_types_result = await session.execute(
        select(Prompt.drum_type).where(
            Prompt.is_user_generated == False
        ).distinct().order_by(Prompt.drum_type)
    )
    drum_types = [dt for dt in drum_types_result.scalars().all() if dt]
    
    if not drum_types:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No prompts available")
    
    # Get the global minimum used_count
    min_used_result = await session.execute(
        select(func.min(Prompt.used_count)).where(Prompt.is_user_generated == False)
    )
    min_used = min_used_result.scalar() or 0
    
    # Determine starting point for rotation
    if start_from_beginning:
        # Initial load: always start from first drum type at difficulty 1
        next_drum_idx = 0
        next_difficulty = 1
    elif current_drum_type and current_difficulty:
        # Continue from current position
        start_drum_idx = drum_types.index(current_drum_type) if current_drum_type in drum_types else 0
        start_difficulty = current_difficulty
        
        # Move to next difficulty, or next drum type if at difficulty 10
        if start_difficulty < 10:
            next_difficulty = start_difficulty + 1
            next_drum_idx = start_drum_idx
        else:
            next_difficulty = 1
            next_drum_idx = (start_drum_idx + 1) % len(drum_types)
    else:
        # Fallback: start from a random position among least-used prompts
        # This ensures variety when opening the site while still prioritizing least-used
        next_drum_idx = random.randint(0, len(drum_types) - 1)
        next_difficulty = random.randint(1, 10)
    
    # Try to find a prompt starting from the next position
    attempts = 0
    max_attempts = len(drum_types) * 10  # All possible combinations
    
    while attempts < max_attempts:
        drum_type = drum_types[next_drum_idx]
        difficulty = next_difficulty
        
        stmt = select(Prompt).where(
            Prompt.drum_type == drum_type,
            Prompt.difficulty == difficulty,
            Prompt.is_user_generated == False,
            Prompt.used_count == min_used
        )
        
        if exclude_id is not None:
            stmt = stmt.where(Prompt.id != exclude_id)
        
        stmt = stmt.order_by(func.random()).limit(1)
        
        result = await session.execute(stmt)
        prompt = result.scalar_one_or_none()
        
        if prompt:
            return PromptRead.model_validate(prompt)
        
        # Move to next position
        if next_difficulty < 10:
            next_difficulty += 1
        else:
            next_difficulty = 1
            next_drum_idx = (next_drum_idx + 1) % len(drum_types)
        
        attempts += 1
    
    # Fallback: get any prompt with lowest usage
    stmt = select(Prompt).where(
        Prompt.is_user_generated == False
    )
    
    if exclude_id is not None:
        stmt = stmt.where(Prompt.id != exclude_id)
    
    stmt = stmt.order_by(Prompt.used_count, func.random()).limit(1)
    
    result = await session.execute(stmt)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No prompts available")
    
    return PromptRead.model_validate(prompt)


@router.get("/random", response_model=PromptRead, summary="Get a random prompt")
async def get_random_prompt(
    exclude_id: Optional[int] = None,
    session: AsyncSession = Depends(get_session)
) -> PromptRead:
    """
    Get a truly random prompt from the entire pool.
    Ignores rotation logic and used_count - purely random selection.
    Only returns non-user-generated prompts.
    """
    stmt = select(Prompt).where(Prompt.is_user_generated == False)
    
    if exclude_id is not None:
        stmt = stmt.where(Prompt.id != exclude_id)
    
    # Get total count for random selection
    count_result = await session.execute(select(func.count()).select_from(stmt.subquery()))
    total_count = count_result.scalar() or 0
    
    if total_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No prompts available")
    
    # Get a random prompt using OFFSET with random order
    stmt = stmt.order_by(func.random()).limit(1)
    result = await session.execute(stmt)
    prompt = result.scalar_one_or_none()
    
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No prompts available")
    
    return PromptRead.model_validate(prompt)


@router.get("/{prompt_id}", response_model=PromptRead, summary="Get prompt by id")
async def get_prompt(prompt_id: int, session: AsyncSession = Depends(get_session)) -> PromptRead:
    result = await session.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    return PromptRead.model_validate(prompt)


@router.put("/{prompt_id}", response_model=PromptRead, summary="Update prompt")
async def update_prompt(
    prompt_id: int, payload: PromptCreate, session: AsyncSession = Depends(get_session)
) -> PromptRead:
    result = await session.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    prompt.text = payload.text
    prompt.difficulty = payload.difficulty
    prompt.category = payload.category
    prompt.drum_type = payload.drum_type
    prompt.expected_parameters = payload.expected_parameters
    await session.commit()
    await session.refresh(prompt)
    return PromptRead.model_validate(prompt)


@router.delete(
    "/{prompt_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete prompt",
    response_class=Response,
)
async def delete_prompt(prompt_id: int, session: AsyncSession = Depends(get_session)) -> Response:
    result = await session.execute(select(Prompt).where(Prompt.id == prompt_id))
    prompt = result.scalar_one_or_none()
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    # Count linked results to understand impact
    linked_results_count = (
        await session.execute(
            select(func.count()).select_from(TestResult).where(TestResult.prompt_id == prompt.id)
        )
    ).scalar() or 0

    logger.info(
        "Deleting prompt id=%s is_user_generated=%s used_count=%s linked_results=%s text_snippet=%r",
        prompt.id,
        prompt.is_user_generated,
        prompt.used_count,
        linked_results_count,
        prompt.text[:120] if prompt.text else "",
    )

    await session.delete(prompt)
    await session.commit()

    logger.info("Deleted prompt id=%s (cascade handled by ORM)", prompt.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

