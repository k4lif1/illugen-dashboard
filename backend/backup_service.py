"""
Database and Audio Files Backup Service
Runs in the FastAPI backend server - daily backups with 14-day retention
"""
import os
import shutil
import logging
from datetime import datetime
from pathlib import Path
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

logger = logging.getLogger(__name__)

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DB_FILE = PROJECT_ROOT / "illugen.db"
AUDIO_DIR = PROJECT_ROOT / "audio_files"
ILLUGEN_AUDIO_DIR = PROJECT_ROOT / "illugen_audio"
NOTE_ATTACHMENTS_DIR = PROJECT_ROOT / "note_attachments"
BACKUP_ROOT = PROJECT_ROOT / "backups"

MAX_BACKUPS = 14


def create_backup():
    """Create a complete backup of database and all audio files"""
    try:
        timestamp = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
        backup_dir = BACKUP_ROOT / f"backup_{timestamp}"
        
        logger.info(f"Starting backup to: {backup_dir}")
        
        # Create backup directory
        backup_dir.mkdir(parents=True, exist_ok=True)
        
        # 1. Backup database
        if DB_FILE.exists():
            shutil.copy2(DB_FILE, backup_dir / "illugen.db")
            logger.info(f"✓ Database backed up: {DB_FILE.stat().st_size} bytes")
        else:
            logger.error(f"❌ Database not found: {DB_FILE}")
            return False
        
        # 2. Backup audio_files directory
        if AUDIO_DIR.exists():
            audio_backup = backup_dir / "audio_files"
            shutil.copytree(AUDIO_DIR, audio_backup, dirs_exist_ok=True)
            audio_count = len(list(audio_backup.glob("*.wav")))
            logger.info(f"✓ Audio files backed up: {audio_count} files")
        else:
            logger.warning(f"⚠️  audio_files directory not found: {AUDIO_DIR}")
        
        # 3. Backup illugen_audio directory
        if ILLUGEN_AUDIO_DIR.exists():
            illugen_backup = backup_dir / "illugen_audio"
            shutil.copytree(ILLUGEN_AUDIO_DIR, illugen_backup, dirs_exist_ok=True)
            illugen_count = len(list(illugen_backup.rglob("*")))
            logger.info(f"✓ Illugen audio backed up: {illugen_count} items")
        else:
            logger.warning(f"⚠️  illugen_audio directory not found: {ILLUGEN_AUDIO_DIR}")
        
        # 4. Backup note_attachments directory
        if NOTE_ATTACHMENTS_DIR.exists():
            notes_backup = backup_dir / "note_attachments"
            shutil.copytree(NOTE_ATTACHMENTS_DIR, notes_backup, dirs_exist_ok=True)
            notes_count = len(list(notes_backup.rglob("*")))
            logger.info(f"✓ Note attachments backed up: {notes_count} items")
        else:
            logger.warning(f"⚠️  note_attachments directory not found: {NOTE_ATTACHMENTS_DIR}")
        
        # 5. Create backup info file
        info_file = backup_dir / "backup_info.txt"
        with open(info_file, 'w') as f:
            f.write(f"Backup created: {timestamp}\n")
            f.write(f"Database: {DB_FILE}\n")
            f.write(f"Audio files: {AUDIO_DIR}\n")
            f.write(f"Illugen audio: {ILLUGEN_AUDIO_DIR}\n")
            f.write(f"Note attachments: {NOTE_ATTACHMENTS_DIR}\n")
        
        logger.info(f"✅ BACKUP COMPLETE: {backup_dir}")
        
        # 5. Clean up old backups (keep only MAX_BACKUPS most recent)
        cleanup_old_backups()
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Backup failed: {e}", exc_info=True)
        return False


def cleanup_old_backups():
    """Keep only the most recent MAX_BACKUPS backups"""
    try:
        # Get all backup directories
        backups = sorted(
            [d for d in BACKUP_ROOT.glob("backup_*") if d.is_dir()],
            key=lambda x: x.stat().st_mtime,
            reverse=True  # Most recent first
        )
        
        # Remove old backups (keep only MAX_BACKUPS)
        if len(backups) > MAX_BACKUPS:
            for old_backup in backups[MAX_BACKUPS:]:
                logger.info(f"Removing old backup: {old_backup.name}")
                shutil.rmtree(old_backup)
                
        logger.info(f"Backup cleanup complete. Keeping {min(len(backups), MAX_BACKUPS)} backups.")
        
    except Exception as e:
        logger.error(f"Error during backup cleanup: {e}", exc_info=True)


def list_backups():
    """List all available backups"""
    backups = sorted(
        [d for d in BACKUP_ROOT.glob("backup_*") if d.is_dir()],
        key=lambda x: x.stat().st_mtime,
        reverse=True
    )
    return [
        {
            "name": b.name,
            "created": datetime.fromtimestamp(b.stat().st_mtime).isoformat(),
            "size_mb": sum(f.stat().st_size for f in b.rglob("*") if f.is_file()) / (1024 * 1024)
        }
        for b in backups
    ]


# Scheduler instance
scheduler = None


def start_backup_scheduler(interval_seconds=43200):
    """
    Start the backup scheduler
    
    Args:
        interval_seconds: Backup interval in seconds (default: 43200 = 12 hours)
    """
    global scheduler
    
    if scheduler is not None:
        logger.warning("Backup scheduler already running")
        return
    
    scheduler = BackgroundScheduler()
    
    # Create immediate backup on startup
    logger.info("Creating initial backup on server startup...")
    create_backup()
    
    # Schedule recurring backups
    scheduler.add_job(
        create_backup,
        trigger=IntervalTrigger(seconds=interval_seconds),
        id='database_backup',
        name='Database and Audio Backup',
        replace_existing=True
    )
    
    scheduler.start()
    logger.info(f"✅ Backup scheduler started! Backing up every {interval_seconds} seconds ({interval_seconds/3600:.1f} hours)")


def stop_backup_scheduler():
    """Stop the backup scheduler"""
    global scheduler
    if scheduler is not None:
        scheduler.shutdown()
        scheduler = None
        logger.info("Backup scheduler stopped")
