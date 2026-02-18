#!/usr/bin/env python3
"""
Export all notes from test_results, model_test_results, and llm_failures.
Count how many notes contain "pitch drift" (case-insensitive).
"""
import csv
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "drumgen.db"
OUTPUT_CSV = Path(__file__).resolve().parent / "exported_notes.csv"


def main():
    if not DB_PATH.exists():
        print(f"Database not found: {DB_PATH}")
        return

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()

    all_rows = []
    pitch_drift_count = 0
    PHRASE = "pitch drift"

    # 1. test_results
    cur.execute(
        """SELECT id, 'test_result' AS source_table, prompt_id, notes, tested_at
           FROM test_results WHERE notes IS NOT NULL AND notes != ''"""
    )
    for row in cur.fetchall():
        notes = row["notes"] or ""
        all_rows.append({
            "id": row["id"],
            "source": "test_results",
            "prompt_id": row["prompt_id"],
            "notes": notes,
            "tested_at": row["tested_at"],
        })
        if PHRASE.lower() in notes.lower():
            pitch_drift_count += 1

    # 2. model_test_results (samples)
    cur.execute(
        """SELECT id, source_dataset, source_filename, source_kind, notes, tested_at
           FROM model_test_results WHERE notes IS NOT NULL AND notes != ''"""
    )
    for row in cur.fetchall():
        notes = row["notes"] or ""
        all_rows.append({
            "id": row["id"],
            "source": "model_test_results",
            "source_dataset": row["source_dataset"],
            "source_filename": row["source_filename"],
            "source_kind": row["source_kind"],
            "notes": notes,
            "tested_at": row["tested_at"],
        })
        if PHRASE.lower() in notes.lower():
            pitch_drift_count += 1

    # 3. llm_failures
    cur.execute(
        """SELECT id, prompt_id, prompt_text, notes, created_at
           FROM llm_failures WHERE notes IS NOT NULL AND notes != ''"""
    )
    for row in cur.fetchall():
        notes = row["notes"] or ""
        all_rows.append({
            "id": row["id"],
            "source": "llm_failures",
            "prompt_id": row["prompt_id"],
            "prompt_text": (row["prompt_text"] or "")[:80],
            "notes": notes,
            "tested_at": row["created_at"],
        })
        if PHRASE.lower() in notes.lower():
            pitch_drift_count += 1

    conn.close()

    # Build flat rows for CSV (normalize keys)
    fieldnames = ["id", "source", "notes", "tested_at", "prompt_id", "source_dataset", "source_filename", "source_kind", "prompt_text"]
    out_rows = []
    for r in all_rows:
        out_rows.append({
            "id": r.get("id"),
            "source": r.get("source"),
            "notes": r.get("notes", ""),
            "tested_at": r.get("tested_at"),
            "prompt_id": r.get("prompt_id", ""),
            "source_dataset": r.get("source_dataset", ""),
            "source_filename": r.get("source_filename", ""),
            "source_kind": r.get("source_kind", ""),
            "prompt_text": r.get("prompt_text", ""),
        })

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        w.writeheader()
        w.writerows(out_rows)

    print(f"Exported {len(all_rows)} notes to {OUTPUT_CSV}")
    print(f"Notes containing \"pitch drift\": {pitch_drift_count}")


if __name__ == "__main__":
    main()
