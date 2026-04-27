from datetime import datetime, timezone
import time

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import os

load_dotenv()

DISCORD_WEBHOOK_URL = os.getenv("DISCORD_WEBHOOK_URL")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


COUNTER_FILE = os.path.join(os.path.dirname(__file__), "visit-count.txt")
VISITOR_COOLDOWN = 3600  # seconds
recent_visitors: dict[str, float] = {}


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

    message = form.message
    if len(message) > 1024:
        message = message[:1021] + "..."

    payload = {
        "embeds": [
            {
                "title": "Contact web from webhook",
                "color": 0x00FF00,
                "fields": [
                    {"name": "Name", "value": form.name, "inline": False},
                    {"name": "Contact me back on", "value": form.contact, "inline": False},
                    {"name": "Message", "value": message, "inline": False},
                    {"name": "IP Address", "value": ip, "inline": True},
                    {"name": "Operating System", "value": os_name, "inline": True},
                    {"name": "Timestamp", "value": timestamp, "inline": False},
                ],
                "footer": {"text": "Website Contact Form"},
            }
        ]
    }

    async with httpx.AsyncClient() as client:
        await client.post(DISCORD_WEBHOOK_URL, json=payload)

    return {"success": True, "message": "Message sent successfully"}
