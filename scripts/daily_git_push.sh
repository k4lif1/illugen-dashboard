#!/bin/bash
# Daily Git Push Script - Commits and pushes database changes to main branch
# Runs daily at 00:00 local time

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# Log file for tracking runs
LOG_FILE="$PROJECT_ROOT/scripts/git_push.log"

# Function to log messages
log_message() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log_message "=== Daily Git Push Started ==="

# Ensure we're on main branch
CURRENT_BRANCH=$(git symbolic-ref --short HEAD 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ]; then
    log_message "⚠️  Currently on branch '$CURRENT_BRANCH', switching to main..."
    git checkout main || {
        log_message "❌ Failed to checkout main branch"
        exit 1
    }
fi

# Check if there are any changes
if git diff-index --quiet HEAD --; then
    log_message "ℹ️  No changes to commit"
    log_message "=== Daily Git Push Completed (No Changes) ==="
    exit 0
fi

# Add all changes (including database)
git add -A

# Create commit with timestamp
COMMIT_MESSAGE="Daily database backup - $(date '+%Y-%m-%d %H:%M:%S')"
git commit -m "$COMMIT_MESSAGE" || {
    log_message "❌ Failed to create commit"
    exit 1
}

log_message "✓ Changes committed: $COMMIT_MESSAGE"

# Push to remote main branch
git push origin main || {
    log_message "❌ Failed to push to remote"
    exit 1
}

log_message "✓ Successfully pushed to origin/main"
log_message "=== Daily Git Push Completed Successfully ==="
