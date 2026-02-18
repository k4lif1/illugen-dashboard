#!/bin/bash
# Start backend server - always runs on main branch

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Get current branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "unknown")

# Always checkout main before starting server
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Currently on branch '$CURRENT_BRANCH'"
    echo "🔄 Switching to main branch for server startup..."
    git checkout main
    echo "✓ Switched to main branch"
fi

# Remove DEV badge if present
if [ -f "scripts/manage_dev_badge.py" ]; then
    python3 scripts/manage_dev_badge.py remove 2>/dev/null || true
fi

# Activate virtual environment
if [ -d "backend/.venv" ]; then
    source backend/.venv/bin/activate
elif [ -d ".venv" ]; then
    source .venv/bin/activate
fi

# Start Model Beta worker (V18 acoustic by default) so /api/model-testing/generate works.
MODEL_ROOT="${DRUMGEN_MODEL_ROOT:-"$HOME/Desktop/V18_Acoustic+Electronic"}"
MODEL_PY="${MODEL_PYTHON_BIN:-python3}"
MODEL_PID=""
export MODEL_BETA_URL="http://127.0.0.1:8001"
"$MODEL_PY" backend/model_beta_worker.py --model-root "$MODEL_ROOT" --onnx-dir "$MODEL_ROOT/onnx_exports/acoustic" --host 127.0.0.1 --port 8001 &
MODEL_PID=$!
echo "✓ Model Beta worker running on $MODEL_BETA_URL (PID: $MODEL_PID)"

# Ensure worker is stopped when this script exits.
cleanup() {
    if [ -n "$MODEL_PID" ]; then
        kill "$MODEL_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

# Start backend server
echo "🚀 Starting backend server on main branch..."
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8000

