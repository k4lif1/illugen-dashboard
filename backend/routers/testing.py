from __future__ import annotations

import asyncio
import time
import uuid
from pathlib import Path
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_session
from ..models import Prompt
from ..services.elevenlabs_music_client import ElevenLabsMusicClient, calc_duration_ms

router = APIRouter()

# Audio files directory
PROJECT_ROOT = Path(__file__).resolve().parents[2]
AUDIO_DIR = PROJECT_ROOT / "audio_files"
AUDIO_DIR.mkdir(exist_ok=True)


class SendPromptRequest(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    prompt_id: Optional[int] = None
    text: Optional[str] = None
    bpm: Optional[int] = None       # None = auto (LLM decides)
    bars: int = 4
    key: Optional[str] = None       # None = auto (LLM decides)
    output_format: str = "pcm_44100"


class VariationResult(BaseModel):
    audio_id: str
    audio_url: str
    original_audio_id: Optional[str] = None
    original_audio_url: Optional[str] = None


class TimingBreakdown(BaseModel):
    llm_time_ms: int
    audio_gen_time_ms: int
    audio_processing_time_ms: int
    total_backend_time_ms: int
    llm_input_tokens: int
    llm_output_tokens: int


class SendPromptResponse(BaseModel):
    prompt_id: Optional[int]
    prompt_text: str
    difficulty: Optional[int] = None
    composition_plan: dict[str, Any]
    llm_response: str
    audio_id: str
    audio_url: str
    variations: list[VariationResult]
    bpm: int
    bars: int
    key: Optional[str] = None
    duration_ms: int
    api_time_ms: int
    timing: Optional[TimingBreakdown] = None


async def get_music_client():
    client = ElevenLabsMusicClient()
    try:
        yield client
    finally:
        await client.close()


async def _generate_and_save(client: ElevenLabsMusicClient, composition_plan: dict, output_format: str) -> dict:
    """Generate audio, save crossfaded loop version.

    Returns dict with audio_id, audio_url, api_time_ms, processing_time_ms.
    Original (non-crossfaded) audio is not saved since no key
    transposition is applied — it would be redundant.
    """
    raw_audio, api_time_ms = await client.generate_audio(composition_plan, output_format)

    proc_start = time.time()
    loop_wav = client.process_audio(raw_audio, output_format)

    loop_id = str(uuid.uuid4())
    with open(AUDIO_DIR / f"{loop_id}.wav", "wb") as f:
        f.write(loop_wav)
    processing_time_ms = int((time.time() - proc_start) * 1000)

    return {
        "audio_id": loop_id,
        "audio_url": f"/api/audio/{loop_id}",
        "original_audio_id": None,
        "original_audio_url": None,
        "api_time_ms": api_time_ms,
        "processing_time_ms": processing_time_ms,
    }


@router.post("/send-prompt", response_model=SendPromptResponse, summary="Generate loop via ElevenLabs")
async def send_prompt(
    payload: SendPromptRequest,
    session: AsyncSession = Depends(get_session),
    client: ElevenLabsMusicClient = Depends(get_music_client),
) -> SendPromptResponse:
    prompt_text = payload.text
    prompt_id: Optional[int] = payload.prompt_id

    prompt_obj: Optional[Prompt] = None
    if prompt_id:
        result = await session.execute(select(Prompt).where(Prompt.id == prompt_id))
        prompt_obj = result.scalar_one_or_none()
        if not prompt_obj:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Prompt not found")
        prompt_text = prompt_obj.text
        prompt_obj.used_count += 1
        await session.commit()
    if not prompt_text:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Provide prompt_id or text.")

    bpm_is_auto = payload.bpm is None
    key_is_auto = payload.key is None

    bpm_for_llm = "auto" if bpm_is_auto else payload.bpm
    key_for_llm = "auto" if key_is_auto else payload.key
    duration_for_llm = None if bpm_is_auto else calc_duration_ms(payload.bpm, payload.bars)

    total_start = time.time()

    # Step 1: 1 LLM call -> composition plan
    try:
        composition_plan, raw_llm_text, llm_stats = await client.generate_composition_plan(
            prompt_text, bpm_for_llm, payload.bars, key_for_llm, duration_for_llm
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM composition plan failed: {e}"
        ) from e

    # Extract chosen BPM/key from LLM response
    final_bpm = payload.bpm
    if bpm_is_auto:
        chosen = composition_plan.get("chosen_bpm")
        final_bpm = int(chosen) if chosen and isinstance(chosen, (int, float)) else 90

    final_key = payload.key
    if key_is_auto:
        final_key = composition_plan.get("chosen_key")

    duration_ms = calc_duration_ms(final_bpm, payload.bars)

    # Step 2: 2 parallel ElevenLabs calls from the same composition plan
    audio_gen_start = time.time()
    try:
        results = await asyncio.gather(
            _generate_and_save(client, composition_plan, payload.output_format),
            _generate_and_save(client, composition_plan, payload.output_format),
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ElevenLabs audio generation failed: {e}"
        ) from e
    audio_gen_wall_ms = int((time.time() - audio_gen_start) * 1000)

    primary = results[0]
    max_api_ms = max(r["api_time_ms"] for r in results)
    max_proc_ms = max(r["processing_time_ms"] for r in results)

    variations = [
        VariationResult(
            audio_id=r["audio_id"],
            audio_url=r["audio_url"],
            original_audio_id=r["original_audio_id"],
            original_audio_url=r["original_audio_url"],
        )
        for r in results
    ]

    difficulty_val = prompt_obj.difficulty if prompt_obj else None
    total_backend_ms = int((time.time() - total_start) * 1000)

    timing = TimingBreakdown(
        llm_time_ms=llm_stats["llm_time_ms"],
        audio_gen_time_ms=max_api_ms,
        audio_processing_time_ms=max_proc_ms,
        total_backend_time_ms=total_backend_ms,
        llm_input_tokens=llm_stats["input_tokens"],
        llm_output_tokens=llm_stats["output_tokens"],
    )

    return SendPromptResponse(
        prompt_id=prompt_id,
        prompt_text=prompt_text,
        difficulty=difficulty_val,
        composition_plan=composition_plan,
        llm_response=raw_llm_text,
        audio_id=primary["audio_id"],
        audio_url=primary["audio_url"],
        variations=variations,
        bpm=final_bpm,
        bars=payload.bars,
        key=final_key,
        duration_ms=duration_ms,
        api_time_ms=max_api_ms,
        timing=timing,
    )
