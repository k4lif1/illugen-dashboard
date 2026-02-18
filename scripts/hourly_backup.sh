#!/bin/bash
# Hourly full backup script
# Creates timestamped backups (DB + audio folders) every hour

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_DIR="$PROJECT_ROOT/database_backups"
DB_FILE="$PROJECT_ROOT/drumgen.db"
AUDIO_DIR="$PROJECT_ROOT/audio_files"
ILLUGEN_DIR="$PROJECT_ROOT/illugen_audio"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Create timestamp
TIMESTAMP=$(date '+%Y-%m-%d_%H-%M-%S')
BACKUP_PATH="$BACKUP_DIR/backup_${TIMESTAMP}"
BACKUP_DB_FILE="$BACKUP_PATH/drumgen.db"
BACKUP_AUDIO_DIR="$BACKUP_PATH/audio_files"
BACKUP_ILLUGEN_DIR="$BACKUP_PATH/illugen_audio"

# Create full backup
if [ -f "$DB_FILE" ]; then
    mkdir -p "$BACKUP_PATH"
    cp "$DB_FILE" "$BACKUP_DB_FILE"

    if [ -d "$AUDIO_DIR" ]; then
        cp -R "$AUDIO_DIR" "$BACKUP_AUDIO_DIR"
    fi
    if [ -d "$ILLUGEN_DIR" ]; then
        cp -R "$ILLUGEN_DIR" "$BACKUP_ILLUGEN_DIR"
    fi

    echo "[$(date)] ✓ Full backup created: $BACKUP_PATH"

    # Keep only last 168 backups (1 week of hourly backups)
    cd "$BACKUP_DIR"
    ls -td backup_* | tail -n +169 | xargs -r rm -rf --

    # Log backup stats (includes model-testing table)
    LLM_COUNT=$(sqlite3 "$BACKUP_DB_FILE" "SELECT COUNT(*) FROM test_results" 2>/dev/null || echo "0")
    MODEL_COUNT=$(sqlite3 "$BACKUP_DB_FILE" "SELECT COUNT(*) FROM model_test_results" 2>/dev/null || echo "0")
    AUDIO_COUNT=$(find "$BACKUP_AUDIO_DIR" -type f -name "*.wav" 2>/dev/null | wc -l | tr -d ' ')
    echo "[$(date)] DB rows: test_results=$LLM_COUNT, model_test_results=$MODEL_COUNT, wav_files=$AUDIO_COUNT"
else
    echo "[$(date)] ❌ Database file not found: $DB_FILE"
    exit 1
fi
