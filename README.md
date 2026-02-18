# DrumGen Scorer

A comprehensive testing system for evaluating DrumGen AI model quality and LLM accuracy.

## Features

- **Testing Interface**: Load prompts from database and test against DrumGen API
- **Analytics Dashboard**: View overall scores, performance by drum type, and difficulty levels
- **Prompt Database Manager**: Search, filter, and manage test prompts
- **Free Text Mode**: Optional mode for testing with custom prompts

## Design

The interface matches the DrumGen website theme with:
- Dark gradient backgrounds (#0d1016, #161a23)
- Cyan (#63d4ff) and purple (#c79bff) accent colors
- Inter font family
- Modern card-based layout with gradient overlays

## Setup

### Backend (FastAPI + SQLite)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

### Frontend (React + Vite)

```bash
cd frontend
npm install
```

## Running the Application

### Option 1: Desktop Shortcut (macOS)

Double-click the **DrumGenServers** icon on your Desktop. This will:
- Start both backend and frontend servers
- Automatically open Chrome to http://localhost:5173
- Keep servers running until you close the terminal

### Option 2: Using Startup Scripts (Recommended)

**Start both servers (always runs on main branch):**
```bash
./scripts/start_servers.sh
```

**Start backend only:**
```bash
./scripts/start_backend.sh
```

**Start frontend only:**
```bash
./scripts/start_frontend.sh
```

**Note:** These scripts automatically switch to the `main` branch before starting, ensuring the server always runs production code even if you're on the `dev` branch in your editor.

### Option 3: Manual Start

**Backend:**
```bash
cd backend
source ../.venv/bin/activate
uvicorn backend.main:app --reload --port 8000
```

**Frontend:**
```bash
cd frontend
npm run dev -- --host --port 5173
```

Then open http://localhost:5173 in your browser.

## API Endpoints

### Backend (http://127.0.0.1:8000)

- `GET /api/health` - Health check
- `GET /api/prompts` - List prompts (with filters)
- `POST /api/prompts/generate` - Generate new prompts
- `DELETE /api/prompts/{id}` - Delete a prompt
- `POST /api/test/send-prompt` - Send prompt to DrumGen and get JSON + audio
- `POST /api/results/score` - Submit test scores
- `GET /api/results/dashboard` - Get analytics data

## Database

SQLite database located at `backend/drumgen.db`

### Tables

**prompts**
- id, text, difficulty (1-10), category, created_at, used_count, expected_parameters

**test_results**
- id, prompt_id, audio_quality_score (1-10), llm_accuracy_score (1-10), generated_json, audio_id, tested_at, notes

## Testing Workflow

1. Navigate to **Testing** page
2. System loads a random prompt from database
3. Review the prompt and click "Send to DrumGen"
4. System sends prompt to DrumGen API, gets LLM JSON and audio
5. Review the generated JSON and play the audio
6. Score both Audio Quality and LLM Accuracy (1-10)
7. Click "Submit Score & Next Prompt" to save and load next prompt

### Free Text Mode

Toggle to **Free Text Mode** to test custom prompts not in the database.

## Technology Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy, aiosqlite, httpx
- **Frontend**: React 18, Vite, React Router
- **Database**: SQLite
- **Prompt Generation**: Template-based system (no external AI)

## DrumGen Integration

The system integrates with the internal Waves DrumGen demo site:
- `POST /process_text` - LLM prompt processing
- `POST /generate` - Audio generation
- `GET /audio/{audio_id}` - Download WAV file

Note: SSL verification is disabled for the internal Waves server.

## Development

- Backend uses async SQLAlchemy for database operations
- Frontend uses modern React hooks and functional components
- All styling matches DrumGen website theme via `theme.css`
- CORS enabled for local development

### DEV Badge

When working on the `dev` branch, a red "DEV" badge appears next to the "DrumGen Scorer" title in the header. This badge:
- Automatically appears when you checkout the `dev` branch
- Automatically disappears when you checkout the `main` branch
- Is automatically removed before committing to `main` (via git hooks)
- Cannot be pushed to `main` (pre-push hook protection)

**Important:** The server startup scripts (`scripts/start_*.sh`) always run on the `main` branch, ensuring production code is served even when developing on `dev`.

## Backup & Persistence

- SQLite database persists all data across server restarts
- Database file: `backend/drumgen.db`
- Backups folder: `backups/` (for manual backups)

## License

Internal Waves project

