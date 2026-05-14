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
