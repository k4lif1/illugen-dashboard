from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel, conint, field_validator, ConfigDict
from typing import Union
from sqlalchemy import Column, DateTime, ForeignKey, Integer, JSON, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Prompt(Base):
    __tablename__ = "prompts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    text: Mapped[str] = mapped_column(String, nullable=False)
    difficulty: Mapped[int] = mapped_column(Integer, nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    drum_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    is_user_generated: Mapped[bool] = mapped_column(Integer, default=False, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)
    used_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    expected_parameters: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)

    results: Mapped[list["TestResult"]] = relationship(
        "TestResult", back_populates="prompt", cascade="all, delete-orphan"
    )


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    prompt_id: Mapped[int] = mapped_column(ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False)
    audio_quality_score: Mapped[int] = mapped_column(Integer, nullable=False)
    llm_accuracy_score: Mapped[int] = mapped_column(Integer, nullable=False)
    generation_score: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # Stored calculated score or NULL for N/A
    generated_json: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    llm_response: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    audio_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    audio_file_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model_version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    notes_audio_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    illugen_generation_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("illugen_generations.id", ondelete="SET NULL"), nullable=True
    )
    illugen_attachments: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    tested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    prompt: Mapped["Prompt"] = relationship("Prompt", back_populates="results")
    illugen_generation: Mapped[Optional["IllugenGeneration"]] = relationship("IllugenGeneration", back_populates="results")


class ModelTestResult(Base):
    __tablename__ = "model_test_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    source_dataset: Mapped[str] = mapped_column(String, nullable=False)
    source_filename: Mapped[str] = mapped_column(String, nullable=False, index=True)
    source_kind: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    source_audio_url: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    source_metadata: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    applied_tags: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    generated_audio_id: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    generated_audio_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    model_version: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    tested_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )


class IllugenGeneration(Base):
    __tablename__ = "illugen_generations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    request_id: Mapped[str] = mapped_column(String, unique=True, nullable=False, index=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    sfx_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    variations: Mapped[Optional[dict[str, Any]]] = mapped_column(JSON, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), nullable=False)

    results: Mapped[list["TestResult"]] = relationship("TestResult", back_populates="illugen_generation")


class LLMFailure(Base):
    __tablename__ = "llm_failures"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    prompt_id: Mapped[Optional[int]] = mapped_column(ForeignKey("prompts.id", ondelete="SET NULL"), nullable=True)
    prompt_text: Mapped[str] = mapped_column(Text, nullable=False)
    llm_response: Mapped[str] = mapped_column(Text, nullable=False)
    model_version: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    drum_type: Mapped[Optional[str]] = mapped_column(String, nullable=True, index=True)
    viewed: Mapped[bool] = mapped_column(Integer, default=False, nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        server_default=func.now(),
        nullable=False,
    )
    # For free text prompts
    free_text_prompt: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    free_text_drum_type: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    free_text_difficulty: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    free_text_category: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    # Preserve notes, audio, and DrumGen audio from original result
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes_audio_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    audio_file_path: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # DrumGen audio
    audio_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)  # DrumGen audio ID

    prompt: Mapped[Optional["Prompt"]] = relationship("Prompt")


# Pydantic schemas
class PromptCreate(BaseModel):
    text: str
    difficulty: conint(ge=1, le=10)
    category: Optional[str] = None
    drum_type: Optional[str] = None
    is_user_generated: bool = False
    expected_parameters: Optional[dict[str, Any]] = None


class PromptRead(BaseModel):
    id: int
    text: str
    difficulty: int
    category: Optional[str]
    drum_type: Optional[str]
    is_user_generated: bool
    created_at: datetime
    used_count: int
    expected_parameters: Optional[dict[str, Any]]

    class Config:
        from_attributes = True


class TestResultCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    prompt_id: Optional[int] = None
    audio_quality_score: conint(ge=1, le=10)
    llm_accuracy_score: conint(ge=1, le=10)
    generated_json: Optional[dict[str, Any]] = None
    llm_response: Optional[str] = None
    audio_id: Optional[str] = None
    audio_file_path: Optional[str] = None
    model_version: Optional[str] = None
    notes: Optional[str] = None
    notes_audio_path: Optional[str] = None
    illugen_generation_id: Optional[int] = None
    illugen_attachments: Optional[dict[str, Any]] = None
    
    # For free text prompts - user provides these
    free_text_prompt: Optional[str] = None
    free_text_drum_type: Optional[str] = None
    free_text_difficulty: Optional[conint(ge=1, le=10)] = None
    free_text_category: Optional[str] = None


class TestResultRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    
    id: int
    prompt_id: int
    audio_quality_score: int
    llm_accuracy_score: int
    generation_score: Optional[int]  # Nullable for N/A
    generated_json: Optional[dict[str, Any]]
    llm_response: Optional[str]
    audio_id: Optional[str]
    audio_file_path: Optional[str]
    model_version: Optional[str]
    notes_audio_path: Optional[str]
    illugen_generation_id: Optional[int]
    illugen_attachments: Optional[dict[str, Any]]
    tested_at: datetime
    notes: Optional[str]
    # Eagerly loaded prompt to avoid N+1 queries
    prompt: Optional[PromptRead] = None
    
    @field_validator('generation_score', mode='before')
    @classmethod
    def round_generation_score(cls, v):
        """Round generation_score to integer if it's a float."""
        if v is None:
            return None
        if isinstance(v, float):
            return round(v)
        return v


class TestResultUpdate(BaseModel):
    audio_quality_score: Optional[conint(ge=1, le=10)] = None
    llm_accuracy_score: Optional[conint(ge=1, le=10)] = None
    notes: Optional[str] = None
    notes_audio_path: Optional[str] = None
    illugen_generation_id: Optional[int] = None
    illugen_attachments: Optional[dict[str, Any]] = None


class LLMFailureCreate(BaseModel):
    model_config = ConfigDict(protected_namespaces=())
    
    prompt_id: Optional[int] = None
    prompt_text: str
    llm_response: str
    model_version: Optional[str] = None
    drum_type: Optional[str] = None
    
    # For free text prompts
    free_text_prompt: Optional[str] = None
    free_text_drum_type: Optional[str] = None
    free_text_difficulty: Optional[conint(ge=1, le=10)] = None
    free_text_category: Optional[str] = None
    
    # Audio fields
    audio_id: Optional[str] = None
    audio_file_path: Optional[str] = None
    notes: Optional[str] = None
    notes_audio_path: Optional[str] = None


class LLMFailureRead(BaseModel):
    model_config = ConfigDict(protected_namespaces=(), from_attributes=True)
    
    id: int
    prompt_id: Optional[int]
    prompt_text: str
    llm_response: str
    model_version: Optional[str]
    drum_type: Optional[str]
    viewed: bool
    created_at: datetime
    free_text_prompt: Optional[str]
    free_text_drum_type: Optional[str]
    free_text_difficulty: Optional[int]
    free_text_category: Optional[str]
    notes: Optional[str]
    notes_audio_path: Optional[str]
    audio_file_path: Optional[str]
    audio_id: Optional[str]


class LLMFailureUpdate(BaseModel):
    viewed: Optional[bool] = None

