from datetime import datetime, timezone
from pathlib import Path
import hmac
import os
import sqlite3
import time

import httpx
import mistune
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

load_dotenv()

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")
ADMIN_TOKEN = os.getenv("ADMIN_TOKEN", "")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"],
)


BACKEND_DIR = Path(__file__).parent
COUNTER_FILE = BACKEND_DIR / "visit-count.txt"
DB_PATH = BACKEND_DIR / "content.db"
TEMPLATES_DIR = BACKEND_DIR / "templates"

VISITOR_COOLDOWN = 3600  # seconds
recent_visitors: dict[str, float] = {}


def _init_db() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS pages (
            slug       TEXT PRIMARY KEY,
            title      TEXT NOT NULL,
            body       TEXT NOT NULL,
            updated_at INTEGER NOT NULL
        )
        """
    )
    conn.commit()
    return conn


db = _init_db()
md = mistune.create_markdown(escape=False)  # raw HTML in body is allowed (single trusted author)
templates = Jinja2Templates(directory=str(TEMPLATES_DIR))


def is_new_visitor(ip: str) -> bool:
    now = time.time()
    last = recent_visitors.get(ip)
    if last is None or (now - last) > VISITOR_COOLDOWN:
        recent_visitors[ip] = now
        return True
    return False


def get_count() -> int:
    try:
        with open(COUNTER_FILE) as f:
            return int(f.read().strip())
    except Exception:
        return 0


def save_count(count: int) -> None:
    try:
        with open(COUNTER_FILE, "w") as f:
            f.write(str(count))
    except Exception:
        pass


class ContactForm(BaseModel):
    name: str
    contact: str
    message: str


class PageIn(BaseModel):
    slug: str
    title: str
    body: str


class PageBody(BaseModel):
    title: str
    body: str


def require_admin(authorization: str = Header(default="")) -> None:
    scheme, _, token = authorization.partition(" ")
    if (
        scheme.lower() != "bearer"
        or not ADMIN_TOKEN
        or not hmac.compare_digest(token, ADMIN_TOKEN)
    ):
        raise HTTPException(status_code=401, detail="unauthorized")


def parse_user_agent(ua: str) -> str:
    if "Windows" in ua:
        return "Windows"
    if "Mac OS" in ua:
        return "macOS"
    if "Linux" in ua:
        return "Linux"
    if "Android" in ua:
        return "Android"
    if "iPhone" in ua or "iPad" in ua:
        return "iOS"
    return "Unknown OS"


async def lookup_ip(ip: str) -> dict:
    clean_ip = ip.split(",")[0].strip()
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            r = await client.get(f"http://ip-api.com/json/{clean_ip}")
            data = r.json()
            if data.get("status") == "success":
                return {
                    "country": data.get("country") or "Unknown",
                    "city": data.get("city") or "Unknown",
                    "isp": data.get("isp") or "Unknown",
                }
    except Exception:
        pass
    return {"country": "Unknown", "city": "Unknown", "isp": "Unknown"}


@app.get("/api/visit")
async def visit(request: Request):
    ip = (
        request.headers.get("x-forwarded-for")
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else "Unknown")
    )
    count = get_count()
    if is_new_visitor(ip):
        count += 1
        save_count(count)
    return {"visits": count}


@app.post("/api/contact")
async def contact(form: ContactForm, request: Request):
    ip = (
        request.headers.get("x-forwarded-for")
        or request.headers.get("x-real-ip")
        or (request.client.host if request.client else "Unknown")
    )
    ua = request.headers.get("user-agent", "Unknown")
    os_name = parse_user_agent(ua)
    timestamp = datetime.now(timezone.utc).isoformat()
    geo = await lookup_ip(ip)

    message = form.message
    if len(message) > 1024:
        message = message[:1021] + "..."

    content = (
        f"Contact form submission\n"
        f"Name: {form.name}\n"
        f"Contact: {form.contact}\n"
        f"Message: {message}\n"
        f"IP: {ip}\n"
        f"OS: {os_name}\n"
        f"Country: {geo['country']}\n"
        f"City: {geo['city']}\n"
        f"ISP: {geo['isp']}\n"
        f"Time: {timestamp}"
    )

    async with httpx.AsyncClient() as client:
        await client.post(DISCORD_WEBHOOK_URL, json={"content": content})

    return {"success": True, "message": "Message sent successfully"}


@app.get("/api/content/pages", dependencies=[Depends(require_admin)])
def list_pages():
    rows = db.execute("SELECT slug, title, updated_at FROM pages ORDER BY slug").fetchall()
    return [dict(r) for r in rows]


@app.get("/api/content/pages/{slug}", dependencies=[Depends(require_admin)])
def get_page_admin(slug: str):
    row = db.execute(
        "SELECT slug, title, body, updated_at FROM pages WHERE slug = ?", (slug,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="page not found")
    return dict(row)


@app.post("/api/content/pages", dependencies=[Depends(require_admin)], status_code=201)
def create_page(page: PageIn):
    now = int(time.time())
    try:
        db.execute(
            "INSERT INTO pages (slug, title, body, updated_at) VALUES (?, ?, ?, ?)",
            (page.slug, page.title, page.body, now),
        )
        db.commit()
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="slug already exists")
    return {"slug": page.slug, "title": page.title, "body": page.body, "updated_at": now}


@app.put("/api/content/pages/{slug}", dependencies=[Depends(require_admin)])
def update_page(slug: str, body: PageBody):
    now = int(time.time())
    cur = db.execute(
        "UPDATE pages SET title = ?, body = ?, updated_at = ? WHERE slug = ?",
        (body.title, body.body, now, slug),
    )
    db.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="page not found")
    return {"slug": slug, "title": body.title, "body": body.body, "updated_at": now}


@app.delete("/api/content/pages/{slug}", dependencies=[Depends(require_admin)], status_code=204)
def delete_page(slug: str):
    cur = db.execute("DELETE FROM pages WHERE slug = ?", (slug,))
    db.commit()
    if cur.rowcount == 0:
        raise HTTPException(status_code=404, detail="page not found")


@app.get("/page/{slug}", response_class=HTMLResponse)
def render_page(slug: str, request: Request):
    row = db.execute(
        "SELECT slug, title, body, updated_at FROM pages WHERE slug = ?", (slug,)
    ).fetchone()
    if row is None:
        raise HTTPException(status_code=404, detail="page not found")
    body_html = md(row["body"])
    return templates.TemplateResponse(
        request=request,
        name="page.html",
        context={"page": dict(row), "body_html": body_html},
    )
