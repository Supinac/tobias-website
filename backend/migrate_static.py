#!/usr/bin/env python3
"""One-off: import frontend/*.html into the pages DB.

Run from anywhere; defaults to ../frontend relative to this script.
Idempotent: slugs that already exist in the DB are skipped (re-run safe).
"""
import re
import sqlite3
import sys
import time
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_FRONTEND = SCRIPT_DIR.parent / "frontend"
DB_PATH = SCRIPT_DIR / "content.db"

TITLE_RE = re.compile(r"<title>(.*?)</title>", re.S | re.I)
BODY_RE = re.compile(r"<body[^>]*>(.*?)</body>", re.S | re.I)


def extract(html: str, fallback_title: str) -> tuple[str, str]:
    t = TITLE_RE.search(html)
    b = BODY_RE.search(html)
    title = (t.group(1) if t else fallback_title).strip()
    body = (b.group(1) if b else html).strip()
    return title, body


def main() -> None:
    frontend = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_FRONTEND
    if not frontend.is_dir():
        sys.exit(f"frontend dir not found: {frontend}")
    if not DB_PATH.exists():
        sys.exit(f"DB not found: {DB_PATH} — start the backend once to initialize it")

    conn = sqlite3.connect(DB_PATH)
    now = int(time.time())
    imported = skipped = 0

    for path in sorted(frontend.glob("*.html")):
        slug = path.stem
        html = path.read_text(encoding="utf-8")
        title, body = extract(html, fallback_title=slug)

        try:
            with conn:
                conn.execute(
                    "INSERT INTO pages (slug, title, body, updated_at) VALUES (?, ?, ?, ?)",
                    (slug, title, body, now),
                )
                conn.execute(
                    "INSERT INTO page_revisions (slug, title, body, updated_at, action) "
                    "VALUES (?, ?, ?, ?, ?)",
                    (slug, title, body, now, "create"),
                )
            print(f"imported {slug!r}: title={title!r}, {len(body)} body chars")
            imported += 1
        except sqlite3.IntegrityError:
            print(f"skipped {slug!r}: slug already exists")
            skipped += 1

    conn.close()
    print(f"\ndone: {imported} imported, {skipped} skipped")


if __name__ == "__main__":
    main()
