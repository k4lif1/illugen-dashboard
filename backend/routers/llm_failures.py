"""
LLM Failures Router
Handles submission and retrieval of LLM failures
"""
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from backend.database import get_session
from backend.models import LLMFailure, Prompt, LLMFailureCreate, LLMFailureRead, LLMFailureUpdate

router = APIRouter()


@router.post("/", response_model=LLMFailureRead, status_code=status.HTTP_201_CREATED, summary="Submit an LLM failure")
async def submit_llm_failure(
    payload: LLMFailureCreate, session: AsyncSession = Depends(get_session)
) -> LLMFailureRead:
    """
    Submit an LLM failure record.
    """
    # Extract drum type from LLM response if not provided
    drum_type = payload.drum_type
    if not drum_type and payload.llm_response:
        # Try to extract from LLM response JSON
        import json
        try:
            llm_data = json.loads(payload.llm_response)
            controls = llm_data.get("controls", {})
            for key in ['Kind', 'kind', 'KIND']:
                if key in controls:
                    drum_type = str(controls[key]).strip()
                    break
        except:
            pass
    
    failure = LLMFailure(
        prompt_id=payload.prompt_id,
        prompt_text=payload.prompt_text,
        llm_response=payload.llm_response,
        model_version=payload.model_version,
        drum_type=drum_type,
        free_text_prompt=payload.free_text_prompt,
        free_text_drum_type=payload.free_text_drum_type or drum_type,
        free_text_difficulty=payload.free_text_difficulty,
        free_text_category=payload.free_text_category,
        viewed=False,
        # Preserve audio from testing page submission
        audio_id=payload.audio_id,
        audio_file_path=payload.audio_file_path,
        notes=payload.notes,
        notes_audio_path=payload.notes_audio_path,
    )
    session.add(failure)
    await session.commit()
    await session.refresh(failure)
    return LLMFailureRead.model_validate(failure)


@router.get("/", response_model=List[LLMFailureRead], summary="List all LLM failures")
async def list_llm_failures(
    drum_type: Optional[str] = None,
    model_version: Optional[str] = None,
    viewed: Optional[bool] = None,
    limit: int = 1000,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
) -> List[LLMFailureRead]:
    """
    List LLM failures with optional filtering.
    """
    query = select(LLMFailure)
    
    if drum_type:
        query = query.where(
            or_(
                LLMFailure.drum_type == drum_type,
                LLMFailure.free_text_drum_type == drum_type
            )
        )
    
    if model_version:
        query = query.where(LLMFailure.model_version == model_version)
    
    if viewed is not None:
        query = query.where(LLMFailure.viewed == (1 if viewed else 0))
    
    query = query.order_by(LLMFailure.created_at.desc()).offset(offset).limit(limit)
    
    result = await session.execute(query)
    failures = result.scalars().all()
    
    return [LLMFailureRead.model_validate(f) for f in failures]


@router.get("/{failure_id}", response_model=LLMFailureRead, summary="Get single LLM failure")
async def get_llm_failure(
    failure_id: int,
    session: AsyncSession = Depends(get_session),
) -> LLMFailureRead:
    """Get a single LLM failure by ID."""
    failure = await session.get(LLMFailure, failure_id)
    if not failure:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM failure not found")
    return LLMFailureRead.model_validate(failure)


@router.put("/{failure_id}", response_model=LLMFailureRead, summary="Update LLM failure")
async def update_llm_failure(
    failure_id: int,
    payload: LLMFailureUpdate,
    session: AsyncSession = Depends(get_session),
) -> LLMFailureRead:
    """Update an LLM failure (e.g., mark as viewed)."""
    failure = await session.get(LLMFailure, failure_id)
    if not failure:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM failure not found")
    
    if payload.viewed is not None:
        failure.viewed = payload.viewed
    
    await session.commit()
    await session.refresh(failure)
    return LLMFailureRead.model_validate(failure)


@router.delete("/{failure_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete LLM failure")
async def delete_llm_failure(
    failure_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete an LLM failure."""
    failure = await session.get(LLMFailure, failure_id)
    if not failure:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="LLM failure not found")
    
    await session.delete(failure)
    await session.commit()

