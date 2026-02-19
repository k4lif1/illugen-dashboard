from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from sqlalchemy import text

from backend.database import Base, engine, async_session_maker
from backend.routers import prompts, results, testing, llm_failures
from backend.services.audio_cleanup import cleanup_all_orphaned_audio
from backend.backup_service import start_backup_scheduler, stop_backup_scheduler


app = FastAPI(title="Illugen Dashboard API")

# Basic CORS setup (adjust origins in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Exception handlers to ensure CORS headers are always added
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with CORS headers."""
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    """Handle HTTP exceptions with CORS headers."""
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    """Handle all other exceptions with CORS headers."""
    import traceback
    print(f"Unhandled exception: {exc}")
    print(traceback.format_exc())
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc)},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Credentials": "true",
        }
    )


async def init_models() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    # Ensure new nullable columns exist when running against an existing DB (SQLite)
    async with engine.begin() as conn:
        # Check columns for test_results table
        result = await conn.execute(text("PRAGMA table_info('test_results')"))
        columns = [row[1] for row in result.fetchall()]
        if "notes_audio_path" not in columns:
            await conn.execute(text("ALTER TABLE test_results ADD COLUMN notes_audio_path TEXT"))
        if "illugen_generation_id" not in columns:
            await conn.execute(text("ALTER TABLE test_results ADD COLUMN illugen_generation_id INTEGER"))
        if "illugen_attachments" not in columns:
            await conn.execute(text("ALTER TABLE test_results ADD COLUMN illugen_attachments JSON"))
        if "generation_score" not in columns:
            await conn.execute(text("ALTER TABLE test_results ADD COLUMN generation_score REAL"))
        if "audio_variations" not in columns:
            await conn.execute(text("ALTER TABLE test_results ADD COLUMN audio_variations JSON"))
        
        # Check if llm_failures table exists
        result = await conn.execute(text("""
            SELECT name FROM sqlite_master 
            WHERE type='table' AND name='llm_failures'
        """))
        if not result.scalar():
            await conn.execute(text("""
                CREATE TABLE llm_failures (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    prompt_id INTEGER,
                    prompt_text TEXT NOT NULL,
                    llm_response TEXT NOT NULL,
                    model_version VARCHAR,
                    drum_type VARCHAR,
                    viewed INTEGER NOT NULL DEFAULT 0,
                    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    free_text_prompt TEXT,
                    free_text_drum_type VARCHAR,
                    free_text_difficulty INTEGER,
                    free_text_category VARCHAR,
                    FOREIGN KEY (prompt_id) REFERENCES prompts(id) ON DELETE SET NULL
                )
            """))
            await conn.execute(text("CREATE INDEX idx_llm_failures_model_version ON llm_failures(model_version)"))
            await conn.execute(text("CREATE INDEX idx_llm_failures_drum_type ON llm_failures(drum_type)"))
            await conn.execute(text("CREATE INDEX idx_llm_failures_viewed ON llm_failures(viewed)"))


@app.on_event("startup")
async def on_startup() -> None:
    await init_models()

    # Daily backups (86400 seconds = 24 hours)
    start_backup_scheduler(interval_seconds=86400)
    
    # Clean up orphaned audio files on startup
    async with async_session_maker() as session:
        deleted_count = await cleanup_all_orphaned_audio(session)
        if deleted_count > 0:
            print(f"🧹 Cleaned up {deleted_count} orphaned audio file(s) on startup")


@app.on_event("shutdown")
async def on_shutdown() -> None:
    stop_backup_scheduler()


# Routers
app.include_router(prompts.router, prefix="/api/prompts", tags=["prompts"])
app.include_router(testing.router, prefix="/api/test", tags=["testing"])
app.include_router(results.router, prefix="/api/results", tags=["results"])
app.include_router(llm_failures.router, prefix="/api/llm-failures", tags=["llm-failures"])


# Audio file serving endpoint
@app.get("/api/audio/{audio_id}")
async def serve_audio(audio_id: str):
    """Serve locally stored audio files."""
    project_root = Path(__file__).resolve().parent.parent
    canonical_audio_path = project_root / "audio_files" / f"{audio_id}.wav"
    legacy_audio_path = project_root / "backend" / "audio_files" / f"{audio_id}.wav"
    audio_path = canonical_audio_path if canonical_audio_path.exists() else legacy_audio_path
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(audio_path, media_type="audio/wav")


@app.get("/api/illugen/audio/{request_id}/{filename}")
async def serve_illugen_audio(request_id: str, filename: str):
    """Serve locally stored Illugen audio files."""
    project_root = Path(__file__).resolve().parent.parent
    audio_path = project_root / "illugen_audio" / request_id / filename
    if not audio_path.exists():
        raise HTTPException(status_code=404, detail="Illugen audio file not found")
    return FileResponse(audio_path, media_type="audio/wav")


@app.get("/health")
async def health_root() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/health")
async def health_api() -> dict[str, str]:
    # Mirror the root health endpoint for frontend/API checks
    return {"status": "ok"}

