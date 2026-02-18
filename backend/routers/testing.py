from __future__ import annotations

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
    bpm: int = 90
    bars: int = 8
    key: Optional[str] = None
    output_format: str = "pcm_44100"


class SendPromptResponse(BaseModel):
    prompt_id: Optional[int]
    prompt_text: str
    difficulty: Optional[int] = None
    composition_plan: dict[str, Any]
    llm_response: str
    audio_id: str
    audio_url: str
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

    duration_ms = calc_duration_ms(payload.bpm, payload.bars)

    # Step 1: LLM -> composition plan
    try:
        composition_plan, raw_llm_text = await client.generate_composition_plan(
            prompt_text, payload.bpm, payload.bars, payload.key, duration_ms
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"LLM composition plan failed: {e}"
        ) from e

    # Step 2: ElevenLabs -> audio
    try:
        raw_audio, api_time_ms = await client.generate_audio(composition_plan, payload.output_format)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"ElevenLabs audio generation failed: {e}"
        ) from e

    # Step 3: Process audio (PCM -> WAV + crossfade)
    wav_data = client.process_audio(raw_audio, payload.output_format)

    # Step 4: Save WAV file
    audio_id = str(uuid.uuid4())
    audio_filename = f"{audio_id}.wav"
    audio_file_path = AUDIO_DIR / audio_filename

    with open(audio_file_path, "wb") as f:
        f.write(wav_data)

    audio_url = f"/api/audio/{audio_id}"
    difficulty_val = prompt_obj.difficulty if prompt_obj else None

    return SendPromptResponse(
        prompt_id=prompt_id,
        prompt_text=prompt_text,
        difficulty=difficulty_val,
        composition_plan=composition_plan,
        llm_response=raw_llm_text,
        audio_id=audio_id,
        audio_url=audio_url,
        bpm=payload.bpm,
        bars=payload.bars,
        key=payload.key,
        duration_ms=duration_ms,
        api_time_ms=api_time_ms,
    )
