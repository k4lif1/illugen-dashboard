#!/bin/bash
# Setup hourly backup using launchd

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Create plist for launchd
PLIST_FILE="$HOME/Library/LaunchAgents/com.drumgen.hourlybackup.plist"

cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.drumgen.hourlybackup</string>
    <key>ProgramArguments</key>
    <array>
        <string>$SCRIPT_DIR/hourly_backup.sh</string>
    </array>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>RunAtLoad</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$PROJECT_ROOT/scripts/hourly_backup.log</string>
    <key>StandardErrorPath</key>
    <string>$PROJECT_ROOT/scripts/hourly_backup_error.log</string>
</dict>
</plist>
EOF

# Load the plist
launchctl unload "$PLIST_FILE" 2>/dev/null
launchctl load "$PLIST_FILE"

echo "✓ Hourly backup system installed"
echo "  Backups will be saved to: $PROJECT_ROOT/database_backups/"
echo "  Logs: $PROJECT_ROOT/scripts/hourly_backup.log"
echo ""
echo "To check status: launchctl list | grep hourlybackup"
echo "To run manually: $SCRIPT_DIR/hourly_backup.sh"
