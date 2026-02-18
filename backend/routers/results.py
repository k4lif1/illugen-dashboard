from __future__ import annotations

from __future__ import annotations

import logging
import re
from datetime import datetime
from typing import Any, Dict, List, Optional
import math
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import func, select, or_, and_
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ..database import get_session
from ..models import (
    Prompt,
    PromptRead,
    TestResult,
    TestResultCreate,
    TestResultRead,
    TestResultUpdate,
    LLMFailure,
)
from ..services.analytics import calculate_generation_score
from ..services.audio_cleanup import cleanup_orphaned_audio_file

logger = logging.getLogger(__name__)

router = APIRouter()

NOTE_AUDIO_DIR = Path("./note_attachments")
NOTE_AUDIO_DIR.mkdir(exist_ok=True)


def normalize_drum_type(value: Optional[str]) -> Optional[str]:
    if not value:
        return None
    normalized = value.strip().lower()
    normalized = normalized.replace('"', '').replace("'", '').replace("`", '')
    normalized = re.sub(r'[\s\-_]+', '', normalized)
    normalized = re.sub(r'[^a-z0-9]', '', normalized)
    return normalized or None


@router.post("/score", response_model=TestResultRead, status_code=status.HTTP_201_CREATED, summary="Submit a score")
async def submit_score(
    payload: TestResultCreate, session: AsyncSession = Depends(get_session)
) -> TestResultRead:
    """
    Submit a test result score.
    """
    # If free text mode, create the prompt first with user-provided tags
    prompt = None
    if payload.free_text_prompt and not payload.prompt_id:
        new_prompt = Prompt(
            text=payload.free_text_prompt,
            difficulty=payload.free_text_difficulty or 5,
            category=payload.free_text_category or "user-generated",
            drum_type=payload.free_text_drum_type,
            is_user_generated=True,
            used_count=1,
            expected_parameters=payload.generated_json
        )
        session.add(new_prompt)
        await session.commit()
        await session.refresh(new_prompt)
        prompt_id = new_prompt.id
        prompt = new_prompt
    else:
        prompt_id = payload.prompt_id
        prompt = await session.get(Prompt, prompt_id)
        if not prompt:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")

    # Calculate generation score
    audio_score = payload.audio_quality_score
    gen_score = None
    if prompt and audio_score:
        gen_score = round(calculate_generation_score(prompt.difficulty, audio_score))
    
    result = TestResult(
        prompt_id=prompt_id,
        audio_quality_score=audio_score,
        llm_accuracy_score=payload.llm_accuracy_score,
        generation_score=gen_score,
        generated_json=payload.generated_json,
        llm_response=payload.llm_response,
        audio_id=payload.audio_id,
        audio_file_path=payload.audio_file_path,
        model_version=payload.model_version,
        notes=payload.notes,
        notes_audio_path=payload.notes_audio_path,
        illugen_generation_id=payload.illugen_generation_id,
        illugen_attachments=payload.illugen_attachments,
    )
    session.add(result)
    await session.commit()
    await session.refresh(result)
    # Eagerly load the prompt relationship for the response
    await session.refresh(result, attribute_names=['prompt'])
    return TestResultRead.model_validate(result)


@router.get("/dashboard", summary="Dashboard analytics")
async def dashboard(
    drum_type: Optional[str] = None,
    model_version: Optional[str] = None,
    session: AsyncSession = Depends(get_session)
) -> Dict[str, Any]:
    """
    Dashboard analytics with optional drum type filtering.
    
    Returns:
    - overall_score: Weighted score (0-100) based on difficulty and accuracy
    - avg_audio_quality: Simple average of audio quality scores
    - avg_llm_accuracy: Simple average of LLM accuracy scores
    - total_tests: Total number of tests
    - by_version: Scores grouped by model version
    - difficulty_distribution: Tests by difficulty with score heat map
    """
    
    # Build base query with optional drum type and version filters
    base_query = select(TestResult, Prompt).join(Prompt, TestResult.prompt_id == Prompt.id)
    if drum_type:
        base_query = base_query.where(Prompt.drum_type == drum_type)
    if model_version:
        base_query = base_query.where(TestResult.model_version == model_version)
    
    # Get all test results with prompt info
    result = await session.execute(base_query)
    tests = [(test, prompt) for test, prompt in result.all()]
    
    if not tests:
        return {
            "overall_score": 0,
            "avg_audio_quality": 0,
            "avg_llm_accuracy": 0,
            "total_tests": 0,
            "by_version": [],
            "difficulty_distribution": []
        }
    
    # Calculate overall generation score (audio only, weighted by difficulty)
    # EXCLUDE N/A scores (where generation_score is NULL)
    generation_scores = []
    audio_scores = []
    llm_scores = []
    
    for test, prompt in tests:
        # Only include generation score if it's not N/A
        if test.generation_score is not None:
            gen_score = test.generation_score  # Use stored value
            generation_scores.append(gen_score)
            if test.audio_quality_score is not None:
                audio_scores.append(test.audio_quality_score)
        elif test.audio_quality_score is not None:
            # Fallback: calculate if not stored (for old records)
            gen_score = calculate_generation_score(
                prompt.difficulty,
                test.audio_quality_score
            )
            generation_scores.append(gen_score)
            audio_scores.append(test.audio_quality_score)
        # Always include LLM score (even when gen_score is N/A)
        llm_scores.append(test.llm_accuracy_score)
    
    overall_generation_score = sum(generation_scores) / len(generation_scores) if generation_scores else 0
    
    # Group by version for progress tracking (generation score only)
    by_version = {}
    for test, prompt in tests:
        version = test.model_version or "unknown"
        if version not in by_version:
            by_version[version] = {
                "version": version,
                "count": 0,
                "generation_scores": [],
                "audio_scores": [],
                "llm_scores": []
            }
        by_version[version]["count"] += 1
        # Only include generation score if not N/A
        if test.generation_score is not None:
            by_version[version]["generation_scores"].append(test.generation_score)
            if test.audio_quality_score is not None:
                by_version[version]["audio_scores"].append(test.audio_quality_score)
        elif test.audio_quality_score is not None:
            # Fallback for old records
            gen_score = calculate_generation_score(
                prompt.difficulty,
                test.audio_quality_score
            )
            by_version[version]["generation_scores"].append(gen_score)
            by_version[version]["audio_scores"].append(test.audio_quality_score)
        # Always include LLM score
        by_version[version]["llm_scores"].append(test.llm_accuracy_score)
    
    # Calculate averages per version
    version_data = []
    for version, data in by_version.items():
        avg_gen = sum(data["generation_scores"]) / len(data["generation_scores"]) if data["generation_scores"] else 0
        avg_audio = sum(data["audio_scores"]) / len(data["audio_scores"]) if data["audio_scores"] else 0
        avg_llm = sum(data["llm_scores"]) / len(data["llm_scores"]) if data["llm_scores"] else 0
        
        version_data.append({
            "version": version,
            "count": data["count"],
            "generation_score": math.ceil(avg_gen),
            "avg_audio": math.ceil(avg_audio * 10) / 10,
            "avg_llm": math.ceil(avg_llm * 10) / 10
        })
    
    # Difficulty distribution with score heat map
    difficulty_dist = {}
    for difficulty in range(1, 11):
        difficulty_dist[difficulty] = {
            "difficulty": difficulty,
            "total_tests": 0,
            "score_distribution": {i: 0 for i in range(1, 11)}  # count by score
        }
    
    for test, prompt in tests:
        diff = prompt.difficulty
        # Use audio (generation) score only for the heat map so reds/greens reflect audio quality
        audio_score = max(1, min(10, int(round(test.audio_quality_score))))
        difficulty_dist[diff]["total_tests"] += 1
        difficulty_dist[diff]["score_distribution"][audio_score] += 1
    
    # Drum type distribution with score heat map (normalized for minor variations)
    drum_type_dist = {}
    for test, prompt in tests:
        raw_drum_type = prompt.drum_type
        drum_key = normalize_drum_type(raw_drum_type)
        if not drum_key:
            continue  # Skip tests without drum type

        if drum_key not in drum_type_dist:
            drum_type_dist[drum_key] = {
                "drum_type_key": drum_key,
                "variants": {},
                "total_tests": 0,
                "score_distribution": {i: 0 for i in range(1, 11)},
                "generation_scores": []
            }

        if raw_drum_type:
            drum_type_dist[drum_key]["variants"][raw_drum_type] = (
                drum_type_dist[drum_key]["variants"].get(raw_drum_type, 0) + 1
            )

        audio_score = max(1, min(10, int(round(test.audio_quality_score))))
        drum_type_dist[drum_key]["total_tests"] += 1
        drum_type_dist[drum_key]["score_distribution"][audio_score] += 1

        # Collect generation scores for average calculation
        if test.generation_score is not None:
            drum_type_dist[drum_key]["generation_scores"].append(test.generation_score)
        elif test.audio_quality_score is not None:
            gen_score = calculate_generation_score(prompt.difficulty, test.audio_quality_score)
            drum_type_dist[drum_key]["generation_scores"].append(gen_score)

    # Calculate average generation score for each drum type and clean up
    drum_type_data = []
    for drum_key, data in drum_type_dist.items():
        avg_gen_score = sum(data["generation_scores"]) / len(data["generation_scores"]) if data["generation_scores"] else 0
        variants = data["variants"]
        display_name = max(variants, key=variants.get) if variants else drum_key
        drum_type_data.append({
            "drum_type": display_name,
            "drum_type_key": drum_key,
            "total_tests": data["total_tests"],
            "generation_score": math.ceil(avg_gen_score),
            "score_distribution": data["score_distribution"]
        })

    # Sort alphabetically by display name
    drum_type_data.sort(key=lambda x: x["drum_type"])
    
    return {
        "overall_generation_score": math.ceil(overall_generation_score),
        "avg_audio_quality": math.ceil((sum(audio_scores) / len(audio_scores)) * 10) / 10 if audio_scores else 0,
        "avg_llm_accuracy": math.ceil((sum(llm_scores) / len(llm_scores)) * 10) / 10 if llm_scores else 0,
        "total_tests": len(tests),
        "by_version": sorted(version_data, key=lambda x: x["version"]),
        "difficulty_distribution": list(difficulty_dist.values()),
        "drum_type_distribution": drum_type_data
    }


# Results CRUD endpoints for Results page
@router.get("/", response_model=List[TestResultRead], summary="List all test results")
async def list_results(
    drum_type: Optional[str] = None,
    drum_type_key: Optional[str] = None,
    difficulty: Optional[int] = None,
    model_version: Optional[str] = None,
    audio_quality_score: Optional[int] = None,
    has_notes: Optional[bool] = None,
    limit: int = 1000,
    offset: int = 0,
    session: AsyncSession = Depends(get_session),
) -> List[TestResultRead]:
    """Get paginated list of test results with optional filtering."""
    # Use left join to ensure all results are returned even if prompt is missing
    # But since we always create prompts (even for free text), inner join should work
    # Eagerly load prompts to avoid N+1 queries on the frontend
    query = (
        select(TestResult)
        .join(Prompt, TestResult.prompt_id == Prompt.id)
        .options(selectinload(TestResult.prompt))
    )
    
    # Apply filters - only add where clause if value is provided and not empty
    if drum_type_key and drum_type_key.strip():
        normalized_input = normalize_drum_type(drum_type_key)
        if normalized_input:
            normalized_column = func.replace(
                func.replace(
                    func.replace(
                        func.replace(
                            func.replace(func.lower(Prompt.drum_type), " ", ""),
                            "-",
                            "",
                        ),
                        "_",
                        "",
                    ),
                    '"',
                    "",
                ),
                "'",
                "",
            )
            query = query.where(normalized_column == normalized_input)
    elif drum_type and drum_type.strip():
        query = query.where(Prompt.drum_type == drum_type)
    if difficulty is not None:
        query = query.where(Prompt.difficulty == difficulty)
    if model_version and model_version.strip():
        query = query.where(TestResult.model_version == model_version)
    if audio_quality_score is not None:
        query = query.where(TestResult.audio_quality_score == audio_quality_score)
    if has_notes is not None:
        if has_notes:
            # Check for notes text (not None and not empty string)
            has_notes_text = and_(TestResult.notes.isnot(None), TestResult.notes != "")
            # Check for notes audio path
            has_notes_audio = TestResult.notes_audio_path.isnot(None)
            # Check for illugen attachments (not None, not JSON "null", not empty object, and has items array with length > 0)
            # Handle both SQL NULL and JSON string "null" cases
            has_illugen = and_(
                TestResult.illugen_attachments.isnot(None),
                TestResult.illugen_attachments != 'null',  # Exclude JSON string "null"
                TestResult.illugen_attachments != '{}',  # Exclude empty JSON object
                func.json_extract(TestResult.illugen_attachments, '$.items').isnot(None),
                func.json_array_length(
                    func.json_extract(TestResult.illugen_attachments, '$.items')
                ) > 0
            )
            query = query.where(or_(has_notes_text, has_notes_audio, has_illugen))
        else:
            # No notes text, no notes audio, and no illugen attachments (or empty)
            no_notes_text = or_(TestResult.notes.is_(None), TestResult.notes == "")
            no_notes_audio = TestResult.notes_audio_path.is_(None)
            # No illugen attachments OR it's SQL NULL OR JSON string "null" OR empty object OR items array doesn't exist/is empty
            no_illugen = or_(
                TestResult.illugen_attachments.is_(None),
                TestResult.illugen_attachments == 'null',  # Include JSON string "null"
                TestResult.illugen_attachments == '{}',  # Include empty JSON object
                func.json_extract(TestResult.illugen_attachments, '$.items').is_(None),
                func.json_array_length(
                    func.json_extract(TestResult.illugen_attachments, '$.items')
                ) == 0
            )
            query = query.where(and_(no_notes_text, no_notes_audio, no_illugen))
    
    query = query.order_by(TestResult.tested_at.desc()).offset(offset).limit(limit)
    
    result = await session.execute(query)
    results = result.scalars().all()
    
    return [TestResultRead.model_validate(r) for r in results]


@router.get("/export-data", summary="Export all test data for analysis")
async def export_data(
    session: AsyncSession = Depends(get_session)
):
    """
    Export comprehensive test data for LLM analysis.
    
    Returns:
    - All test results with full details
    - Scores by version, drum type, and difficulty
    - User notes with context
    - Analytics and distributions
    """
    
    try:
        # Get all test results with prompts
        query = select(TestResult, Prompt).join(Prompt, TestResult.prompt_id == Prompt.id)
        result = await session.execute(query)
        all_tests = [(test, prompt) for test, prompt in result.all()]
        
        # Organize data by multiple dimensions
        export_dict = {
            "export_timestamp": datetime.now().isoformat(),
            "total_tests": len(all_tests),
            "summary": {
                "overall_generation_score": 0,
                "avg_audio_quality": 0,
                "avg_llm_accuracy": 0,
            },
            "by_version": {},
            "by_drum_type": {},
            "by_difficulty": {},
            "by_version_and_drum": {},
            "by_version_and_difficulty": {},
            "by_drum_and_difficulty": {},
            "all_results": [],
            "user_notes": [],
        }
        
        if not all_tests:
            return JSONResponse(content=export_dict)
        
        # Calculate overall metrics (EXCLUDE N/A scores)
        generation_scores = []
        audio_scores = []
        llm_scores = []
        
        for test, prompt in all_tests:
            # Only include generation score if not N/A
            if test.generation_score is not None:
                generation_scores.append(test.generation_score)
                if test.audio_quality_score is not None:
                    audio_scores.append(test.audio_quality_score)
            elif test.audio_quality_score is not None:
                # Fallback for old records
                gen_score = calculate_generation_score(prompt.difficulty, test.audio_quality_score)
                generation_scores.append(gen_score)
                audio_scores.append(test.audio_quality_score)
            # Always include LLM score
            llm_scores.append(test.llm_accuracy_score)
        
        export_dict["summary"]["overall_generation_score"] = round(sum(generation_scores) / len(generation_scores), 2)
        export_dict["summary"]["avg_audio_quality"] = round(sum(audio_scores) / len(audio_scores), 2)
        export_dict["summary"]["avg_llm_accuracy"] = round(sum(llm_scores) / len(llm_scores), 2)
        
        # Process each test result
        for test, prompt in all_tests:
            version = test.model_version or "unknown"
            drum_type = prompt.drum_type or "unknown"
            difficulty = prompt.difficulty
            
            # Get generation score (use stored value or calculate for old records)
            if test.generation_score is not None:
                gen_score = test.generation_score
            elif test.audio_quality_score is not None:
                gen_score = calculate_generation_score(difficulty, test.audio_quality_score)
            else:
                gen_score = None  # N/A case
            
            # Initialize dictionaries (use string keys for JSON serialization)
            if version not in export_dict["by_version"]:
                export_dict["by_version"][version] = {
                    "count": 0,
                    "generation_scores": [],
                    "audio_scores": [],
                    "llm_scores": []
                }
            if drum_type not in export_dict["by_drum_type"]:
                export_dict["by_drum_type"][drum_type] = {
                    "count": 0,
                    "generation_scores": [],
                    "audio_scores": [],
                    "llm_scores": []
                }
            
            # Use string key for difficulty
            diff_key = str(difficulty)
            if diff_key not in export_dict["by_difficulty"]:
                export_dict["by_difficulty"][diff_key] = {
                    "difficulty": difficulty,
                    "count": 0,
                    "generation_scores": [],
                    "audio_scores": [],
                    "llm_scores": [],
                    "score_distribution": {str(i): 0 for i in range(1, 11)}
                }
            
            # Version + Drum
            version_drum_key = f"{version}_{drum_type}"
            if version_drum_key not in export_dict["by_version_and_drum"]:
                export_dict["by_version_and_drum"][version_drum_key] = {
                    "version": version,
                    "drum_type": drum_type,
                    "count": 0,
                    "generation_scores": [],
                    "audio_scores": [],
                    "llm_scores": []
                }
            
            # Version + Difficulty
            version_diff_key = f"{version}_diff{difficulty}"
            if version_diff_key not in export_dict["by_version_and_difficulty"]:
                export_dict["by_version_and_difficulty"][version_diff_key] = {
                    "version": version,
                    "difficulty": difficulty,
                    "count": 0,
                    "generation_scores": [],
                    "audio_scores": [],
                    "llm_scores": []
                }
            
            # Drum + Difficulty
            drum_diff_key = f"{drum_type}_diff{difficulty}"
            if drum_diff_key not in export_dict["by_drum_and_difficulty"]:
                export_dict["by_drum_and_difficulty"][drum_diff_key] = {
                    "drum_type": drum_type,
                    "difficulty": difficulty,
                    "count": 0,
                    "generation_scores": [],
                    "audio_scores": [],
                    "llm_scores": []
                }
            
            # Add scores to all relevant categories
            export_dict["by_version"][version]["count"] += 1
            # Only include generation score if not N/A
            if gen_score is not None:
                export_dict["by_version"][version]["generation_scores"].append(gen_score)
                if test.audio_quality_score is not None:
                    export_dict["by_version"][version]["audio_scores"].append(test.audio_quality_score)
            elif test.audio_quality_score is not None:
                export_dict["by_version"][version]["audio_scores"].append(test.audio_quality_score)
            # Always include LLM score
            export_dict["by_version"][version]["llm_scores"].append(test.llm_accuracy_score)
            
            export_dict["by_drum_type"][drum_type]["count"] += 1
            if gen_score is not None:
                export_dict["by_drum_type"][drum_type]["generation_scores"].append(gen_score)
                if test.audio_quality_score is not None:
                    export_dict["by_drum_type"][drum_type]["audio_scores"].append(test.audio_quality_score)
            elif test.audio_quality_score is not None:
                export_dict["by_drum_type"][drum_type]["audio_scores"].append(test.audio_quality_score)
            export_dict["by_drum_type"][drum_type]["llm_scores"].append(test.llm_accuracy_score)
            
            export_dict["by_difficulty"][diff_key]["count"] += 1
            if gen_score is not None:
                export_dict["by_difficulty"][diff_key]["generation_scores"].append(gen_score)
                if test.audio_quality_score is not None:
                    export_dict["by_difficulty"][diff_key]["audio_scores"].append(test.audio_quality_score)
                    audio_score_int = max(1, min(10, int(round(test.audio_quality_score))))
                    export_dict["by_difficulty"][diff_key]["score_distribution"][str(audio_score_int)] += 1
            elif test.audio_quality_score is not None:
                export_dict["by_difficulty"][diff_key]["audio_scores"].append(test.audio_quality_score)
                audio_score_int = max(1, min(10, int(round(test.audio_quality_score))))
                export_dict["by_difficulty"][diff_key]["score_distribution"][str(audio_score_int)] += 1
            export_dict["by_difficulty"][diff_key]["llm_scores"].append(test.llm_accuracy_score)
            
            export_dict["by_version_and_drum"][version_drum_key]["count"] += 1
            if gen_score is not None:
                export_dict["by_version_and_drum"][version_drum_key]["generation_scores"].append(gen_score)
                if test.audio_quality_score is not None:
                    export_dict["by_version_and_drum"][version_drum_key]["audio_scores"].append(test.audio_quality_score)
            elif test.audio_quality_score is not None:
                export_dict["by_version_and_drum"][version_drum_key]["audio_scores"].append(test.audio_quality_score)
            export_dict["by_version_and_drum"][version_drum_key]["llm_scores"].append(test.llm_accuracy_score)
            
            export_dict["by_version_and_difficulty"][version_diff_key]["count"] += 1
            if gen_score is not None:
                export_dict["by_version_and_difficulty"][version_diff_key]["generation_scores"].append(gen_score)
                if test.audio_quality_score is not None:
                    export_dict["by_version_and_difficulty"][version_diff_key]["audio_scores"].append(test.audio_quality_score)
            elif test.audio_quality_score is not None:
                export_dict["by_version_and_difficulty"][version_diff_key]["audio_scores"].append(test.audio_quality_score)
            export_dict["by_version_and_difficulty"][version_diff_key]["llm_scores"].append(test.llm_accuracy_score)
            
            export_dict["by_drum_and_difficulty"][drum_diff_key]["count"] += 1
            if gen_score is not None:
                export_dict["by_drum_and_difficulty"][drum_diff_key]["generation_scores"].append(gen_score)
                if test.audio_quality_score is not None:
                    export_dict["by_drum_and_difficulty"][drum_diff_key]["audio_scores"].append(test.audio_quality_score)
            elif test.audio_quality_score is not None:
                export_dict["by_drum_and_difficulty"][drum_diff_key]["audio_scores"].append(test.audio_quality_score)
            export_dict["by_drum_and_difficulty"][drum_diff_key]["llm_scores"].append(test.llm_accuracy_score)
            
            # Collect full result details - convert to dict and handle JSON serialization
            result_detail = {
                "result_id": test.id,
                "prompt_text": prompt.text,
                "prompt_category": prompt.category,
                "drum_type": drum_type,
                "difficulty": difficulty,
                "model_version": version,
                "audio_quality_score": float(test.audio_quality_score) if test.audio_quality_score is not None else None,
                "llm_accuracy_score": float(test.llm_accuracy_score),
                "generation_score": round(gen_score, 2) if gen_score is not None else None,
                "generated_json": test.generated_json if test.generated_json else {},
                "llm_response": test.llm_response if test.llm_response else "",
                "tested_at": str(test.tested_at) if test.tested_at else "",
                "notes": test.notes if test.notes else "",
                "has_notes_audio": bool(test.notes_audio_path),
                "has_illugen_attachments": bool(test.illugen_attachments and test.illugen_attachments.get("items")),
            }
            export_dict["all_results"].append(result_detail)
            
            # Collect user notes with context
            if test.notes and test.notes.strip():
                export_dict["user_notes"].append({
                    "result_id": test.id,
                    "note": test.notes,
                    "drum_type": drum_type,
                    "model_version": version,
                    "difficulty": difficulty,
                    "audio_quality_score": float(test.audio_quality_score),
                    "llm_accuracy_score": float(test.llm_accuracy_score),
                    "prompt_text": prompt.text,
                    "tested_at": str(test.tested_at) if test.tested_at else "",
                })
        
        # Calculate averages for all grouped categories
        for category_dict in [
            export_dict["by_version"],
            export_dict["by_drum_type"],
            export_dict["by_difficulty"],
            export_dict["by_version_and_drum"],
            export_dict["by_version_and_difficulty"],
            export_dict["by_drum_and_difficulty"],
        ]:
            for key, data in category_dict.items():
                if data["generation_scores"]:
                    data["avg_generation_score"] = round(sum(data["generation_scores"]) / len(data["generation_scores"]), 2)
                if data["audio_scores"]:
                    data["avg_audio_quality"] = round(sum(data["audio_scores"]) / len(data["audio_scores"]), 2)
                if data["llm_scores"]:
                    data["avg_llm_accuracy"] = round(sum(data["llm_scores"]) / len(data["llm_scores"]), 2)
                # Remove raw score lists to keep export clean
                del data["generation_scores"]
                del data["audio_scores"]
                del data["llm_scores"]
        
        return JSONResponse(content=export_dict)
    
    except Exception as e:
        logger.error(f"Export data error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Export failed: {str(e)}")


@router.get("/{result_id}", response_model=TestResultRead, summary="Get single test result")
async def get_result(
    result_id: int,
    session: AsyncSession = Depends(get_session),
) -> TestResultRead:
    """Get detailed info for a specific test result."""
    result = await session.get(TestResult, result_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")
    # Eagerly load the prompt relationship for the response
    await session.refresh(result, attribute_names=['prompt'])
    return TestResultRead.model_validate(result)


@router.put("/{result_id}", response_model=TestResultRead, summary="Update test result")
async def update_result(
    result_id: int,
    payload: TestResultUpdate,
    session: AsyncSession = Depends(get_session),
) -> TestResultRead:
    """Update scores or notes for a test result."""
    result = await session.get(TestResult, result_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")
    
    if payload.audio_quality_score is not None:
        result.audio_quality_score = payload.audio_quality_score
    if payload.llm_accuracy_score is not None:
        result.llm_accuracy_score = payload.llm_accuracy_score
    if payload.notes is not None:
        result.notes = payload.notes
    if payload.notes_audio_path is not None:
        # Empty string clears the attachment
        result.notes_audio_path = payload.notes_audio_path or None
    if payload.illugen_generation_id is not None:
        result.illugen_generation_id = payload.illugen_generation_id
    if payload.illugen_attachments is not None:
        result.illugen_attachments = payload.illugen_attachments
    
    await session.commit()
    await session.refresh(result)
    # Eagerly load the prompt relationship for the response
    await session.refresh(result, attribute_names=['prompt'])
    return TestResultRead.model_validate(result)


@router.post(
    "/upload-note-audio",
    summary="Upload audio attachment for notes",
    status_code=status.HTTP_201_CREATED,
)
async def upload_note_audio(file: UploadFile = File(...)) -> Dict[str, str]:
    if not file.filename.lower().endswith(".wav"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only .wav files are supported")
    content = await file.read()
    filename = f"note-{uuid4()}.wav"
    out_path = NOTE_AUDIO_DIR / filename
    out_path.write_bytes(content)
    return {
        "path": f"/api/results/note-audio/{filename}",
        "filename": file.filename,
        "stored_as": filename,
    }


@router.get("/note-audio/{filename}", summary="Serve note audio attachment")
async def serve_note_audio(filename: str):
    target = NOTE_AUDIO_DIR / filename
    if not target.exists():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attachment not found")
    return FileResponse(target, media_type="audio/wav")


@router.delete("/{result_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete test result")
async def delete_result(
    result_id: int,
    session: AsyncSession = Depends(get_session),
):
    """Delete a test result."""
    result = await session.get(TestResult, result_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")
    
    audio_id = result.audio_id
    has_illugen = bool(result.illugen_attachments and result.illugen_attachments.get("items"))

    logger.info(
        "Deleting result id=%s prompt_id=%s audio_id=%s model_version=%s illugen_generation_id=%s has_illugen_attachments=%s notes_audio_path=%s",
        result.id,
        result.prompt_id,
        audio_id,
        result.model_version,
        result.illugen_generation_id,
        has_illugen,
        result.notes_audio_path,
    )
    
    await session.delete(result)
    await session.commit()
    
    # Clean up audio file if it's no longer linked to any result
    if audio_id:
        removed = await cleanup_orphaned_audio_file(audio_id, session)
        logger.info(
            "Post-delete audio cleanup for audio_id=%s removed=%s", audio_id, removed
        )

    logger.info("Deleted result id=%s", result_id)


@router.post("/{result_id}/set-as-llm-failure", status_code=status.HTTP_201_CREATED, summary="Convert result to LLM failure")
async def set_result_as_llm_failure(
    result_id: int,
    session: AsyncSession = Depends(get_session),
):
    """
    Convert a test result to an LLM failure.
    This will:
    1. Create an LLM failure record from the result (preserving notes and audio)
    2. Delete the result (removing it from averages)
    3. Keep the audio file and notes for reference
    """
    result = await session.get(TestResult, result_id)
    if not result:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Result not found")
    
    # Get prompt for prompt_text
    prompt = await session.get(Prompt, result.prompt_id)
    if not prompt:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
    
    # Extract drum type from LLM response if available
    drum_type = None
    if result.llm_response:
        import json
        try:
            llm_data = json.loads(result.llm_response)
            controls = llm_data.get("controls", {})
            for key in ['Kind', 'kind', 'KIND']:
                if key in controls:
                    drum_type = str(controls[key]).strip()
                    break
        except:
            pass
    
    # Use prompt's drum_type if LLM extraction failed
    if not drum_type:
        drum_type = prompt.drum_type
    
    # Ensure llm_response is not None (required field)
    llm_response_text = result.llm_response
    if not llm_response_text:
        # If no LLM response, try to use generated_json as fallback
        if result.generated_json:
            import json
            try:
                llm_response_text = json.dumps(result.generated_json, indent=2)
            except:
                llm_response_text = str(result.generated_json)
        else:
            llm_response_text = 'No LLM response available'
    
    # Create LLM failure record (saved to database) - PRESERVE notes and audio
    llm_failure = LLMFailure(
        prompt_id=result.prompt_id,
        prompt_text=prompt.text,
        llm_response=llm_response_text,
        model_version=result.model_version,
        drum_type=drum_type,
        viewed=False,
        notes=result.notes,  # ← Preserve notes
        notes_audio_path=result.notes_audio_path,  # ← Preserve notes audio
        audio_file_path=result.audio_file_path,  # ← Preserve DrumGen audio path
        audio_id=result.audio_id,  # ← Preserve DrumGen audio ID
    )
    session.add(llm_failure)
    
    # Store audio_id before deletion (for logging only - we DON'T delete it)
    audio_id = result.audio_id
    
    # Delete the result (this removes it from all averages)
    await session.delete(result)
    
    # Commit both operations atomically
    await session.commit()
    
    # DO NOT clean up audio files - they are preserved for reference
    logger.info(
        "Converted result id=%s to LLM failure id=%s, preserved audio_id=%s notes=%s notes_audio=%s",
        result_id, llm_failure.id, audio_id, bool(result.notes), bool(result.notes_audio_path)
    )
    
    logger.info("Converted result id=%s to LLM failure id=%s", result_id, llm_failure.id)
    return {"llm_failure_id": llm_failure.id, "message": "Result converted to LLM failure"}


