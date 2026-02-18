#!/usr/bin/env python3
"""
Script to add or remove DEV badge from App.jsx based on git branch.
"""
import sys
import re
from pathlib import Path

APP_JSX = Path("frontend/src/App.jsx")

DEV_BADGE_CODE = """          {/* DEV_BADGE_START */}
          <div style={{
            backgroundColor: 'rgba(239, 68, 68, 0.9)',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '700',
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
          }}>
            DEV
          </div>
          {/* DEV_BADGE_END */}"""

def remove_badge(content):
    """Remove DEV badge and restore original h1 structure."""
    # First, remove the badge code between markers
    content = re.sub(
        r'\s*{/\* DEV_BADGE_START \*/}.*?{/\* DEV_BADGE_END \*/}',
        '',
        content,
        flags=re.DOTALL
    )
    
    # Now remove the flex wrapper div and restore original h1
    # Match: <div style={{...flex...}}>\n<h1 style={{...margin: 0...}}>\nDrumGen Scorer\n</h1>\n</div>
    # Replace with: <h1 style={{...zIndex: 1...}}>\n          DrumGen Scorer\n        </h1>
    
    # Pattern that matches the entire wrapper structure (handle both style={{ and style={)
    # First try to match correct syntax with style={{}}
    pattern = (
        r'<div style=\{\{ display: \'flex\', alignItems: \'center\', gap: \'12px\', zIndex: 1 \}\}>\s*\n'
        r'\s*<h1 style=\{\{ fontSize: \'24px\', fontWeight: \'700\', margin: 0 \}\}>\s*\n'
        r'\s*DrumGen Scorer\s*\n'
        r'\s*</h1>\s*\n'
        r'\s*</div>'
    )
    replacement = '<h1 style={{ fontSize: \'24px\', fontWeight: \'700\', zIndex: 1 }}>\n          DrumGen Scorer\n        </h1>'
    
    # Try the multiline pattern first
    if re.search(pattern, content, flags=re.MULTILINE | re.DOTALL):
        content = re.sub(pattern, replacement, content, flags=re.MULTILINE | re.DOTALL)
    else:
        # Fallback: handle corrupted syntax with style={ (missing one brace)
        pattern_corrupted = (
            r'<div style=\{ display: \'flex\', alignItems: \'center\', gap: \'12px\', zIndex: 1 \}>\s*\n'
            r'\s*<h1 style=\{ fontSize: \'24px\', fontWeight: \'700\', margin: 0 \}>\s*\n'
            r'\s*DrumGen Scorer\s*\n'
            r'\s*</h1>\s*\n'
            r'\s*</div>'
        )
        if re.search(pattern_corrupted, content, flags=re.MULTILINE | re.DOTALL):
            content = re.sub(pattern_corrupted, replacement, content, flags=re.MULTILINE | re.DOTALL)
        else:
            # Last fallback: simpler pattern that matches across any whitespace
            pattern2 = (
                r'<div style=\{\{?[^}]*display: \'flex\'[^}]*\}?\}>'
                r'.*?'
                r'<h1 style=\{\{?[^}]*margin: 0[^}]*\}?\}>'
                r'.*?'
                r'DrumGen Scorer'
                r'.*?'
                r'</h1>'
                r'.*?'
                r'</div>'
            )
            content = re.sub(pattern2, replacement, content, flags=re.DOTALL)
    
    # Clean up any extra whitespace
    content = re.sub(r'\n\s*\n\s*\n', '\n\n', content)
    
    return content

def add_badge(content):
    """Add DEV badge if not present."""
    if 'DEV_BADGE_START' in content:
        return content  # Already present
    
    # Find the h1 tag and wrap it with flex container + add badge
    # Handle both with and without zIndex in h1
    pattern = r'(<h1 style={{ fontSize: \'24px\', fontWeight: \'700\'(?:, zIndex: 1)? }}>\s*\n\s*DrumGen Scorer\s*\n\s*</h1>)'
    
    replacement = f"""        <div style={{{{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1 }}}}>
          <h1 style={{{{ fontSize: '24px', fontWeight: '700', margin: 0 }}}}>
            DrumGen Scorer
          </h1>
{DEV_BADGE_CODE}
        </div>"""
    
    content = re.sub(pattern, replacement, content, flags=re.MULTILINE)
    return content

def main():
    if len(sys.argv) < 2:
        print("Usage: manage_dev_badge.py [add|remove]")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if not APP_JSX.exists():
        print(f"Error: {APP_JSX} not found")
        sys.exit(1)
    
    content = APP_JSX.read_text()
    
    if action == "remove":
        content = remove_badge(content)
        APP_JSX.write_text(content)
        print("✓ DEV badge removed")
    elif action == "add":
        content = add_badge(content)
        APP_JSX.write_text(content)
        print("✓ DEV badge added")
    else:
        print(f"Error: Unknown action '{action}'. Use 'add' or 'remove'")
        sys.exit(1)

if __name__ == "__main__":
    main()
