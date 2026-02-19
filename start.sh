#!/usr/bin/env bash
# Start both backend (FastAPI) and frontend (Vite) in parallel.
# Kills any previous instances first. Ctrl-C stops both.

set -e

DIR="$(cd "$(dirname "$0")" && pwd)"

# Kill previous instances
echo "Killing previous instances..."
lsof -ti :8000 | xargs kill -9 2>/dev/null || true
lsof -ti :5173 | xargs kill -9 2>/dev/null || true
sleep 0.5

cleanup() {
  echo ""
  echo "Shutting down..."
  kill 0 2>/dev/null
  wait 2>/dev/null
}
trap cleanup EXIT INT TERM

# Backend
echo "Starting backend on http://localhost:8000 ..."
cd "$DIR" && uvicorn backend.main:app --reload --port 8000 --log-level debug &

# Frontend
echo "Starting frontend on http://localhost:5173 ..."
cd "$DIR/frontend" && npm run dev &

wait
