from __future__ import annotations

import asyncio
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


async def get_music_client():
    client = ElevenLabsMusicClient()
    try:
        yield client
    finally:
        await client.close()


async def _generate_and_save(client: ElevenLabsMusicClient, composition_plan: dict, output_format: str) -> tuple[str, str, int]:
    """Generate audio, process it, save to disk. Returns (audio_id, audio_url, api_time_ms)."""
    raw_audio, api_time_ms = await client.generate_audio(composition_plan, output_format)
    wav_data = client.process_audio(raw_audio, output_format)

    audio_id = str(uuid.uuid4())
    audio_file_path = AUDIO_DIR / f"{audio_id}.wav"
    with open(audio_file_path, "wb") as f:
        f.write(wav_data)

    return audio_id, f"/api/audio/{audio_id}", api_time_ms


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

    # Step 1: 1 LLM call -> composition plan
    try:
        composition_plan, raw_llm_text = await client.generate_composition_plan(
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

    # First result is the "primary", both go into variations
    primary_id, primary_url, primary_api_ms = results[0]
    max_api_ms = max(r[2] for r in results)

    variations = [
        VariationResult(audio_id=r[0], audio_url=r[1])
        for r in results
    ]

    difficulty_val = prompt_obj.difficulty if prompt_obj else None

    return SendPromptResponse(
        prompt_id=prompt_id,
        prompt_text=prompt_text,
        difficulty=difficulty_val,
        composition_plan=composition_plan,
        llm_response=raw_llm_text,
        audio_id=primary_id,
        audio_url=primary_url,
        variations=variations,
        bpm=final_bpm,
        bars=payload.bars,
        key=final_key,
        duration_ms=duration_ms,
        api_time_ms=max_api_ms,
    )
