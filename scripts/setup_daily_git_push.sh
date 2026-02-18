#!/bin/bash
# Setup script for daily git push automation

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

echo "🔧 Setting up daily git push automation..."

# Make the daily git push script executable
chmod +x "$SCRIPT_DIR/daily_git_push.sh"
echo "✓ Made daily_git_push.sh executable"

# Copy plist to LaunchAgents directory (macOS)
if [[ "$OSTYPE" == "darwin"* ]]; then
    LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
    mkdir -p "$LAUNCH_AGENTS_DIR"
    
    PLIST_SOURCE="$SCRIPT_DIR/com.drumgen.dailygitpush.plist"
    PLIST_DEST="$LAUNCH_AGENTS_DIR/com.drumgen.dailygitpush.plist"
    
    # Update the script path in plist
    sed "s|/Users/qa_m2/Documents/Cursor AI/DrumGen Scorer|$PROJECT_ROOT|g" "$PLIST_SOURCE" > "$PLIST_DEST"
    
    echo "✓ Created LaunchAgent plist file"
    
    # Load the launch agent
    launchctl unload "$PLIST_DEST" 2>/dev/null || true
    launchctl load "$PLIST_DEST"
    echo "✓ Loaded LaunchAgent (will run daily at 00:00)"
    
    echo ""
    echo "✅ Setup complete! The script will run daily at 00:00 local time."
    echo "📋 To check status: launchctl list | grep com.drumgen.dailygitpush"
    echo "📋 To view logs: tail -f $SCRIPT_DIR/git_push.log"
    echo "📋 To unload: launchctl unload $PLIST_DEST"
else
    echo "⚠️  This script is for macOS. For Windows, use Task Scheduler:"
    echo ""
    echo "Windows Setup Instructions:"
    echo "1. Open Task Scheduler"
    echo "2. Create Basic Task"
    echo "3. Name: Daily Git Push"
    echo "4. Trigger: Daily at 00:00"
    echo "5. Action: Start a program"
    echo "6. Program: C:\\Program Files\\Git\\bin\\bash.exe"
    echo "7. Arguments: $PROJECT_ROOT/scripts/daily_git_push.sh"
    echo "8. Start in: $PROJECT_ROOT"
fi
