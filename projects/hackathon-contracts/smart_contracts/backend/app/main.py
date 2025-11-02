# app/main.py
from __future__ import annotations

from pathlib import Path
import sys as _sys

_SMART_CONTRACTS_ROOT = Path(__file__).resolve().parents[2]
_HACKATHON_SRC = _SMART_CONTRACTS_ROOT / "hackathon" / "src"
if str(_HACKATHON_SRC) not in _sys.path:
    _sys.path.insert(0, str(_HACKATHON_SRC))
# --------------------------------------------------------------------

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from dotenv import load_dotenv

# Routers (these may import from `hackathon`, which now resolves)
from app.routers import waiting_list, auth
from app.routers import user as user_router
from app.routers import paypal as paypal_api_router
from app.routers import paypal_link as paypal_link_api
from app.routers import ramp as ramp_router
from app.routers import tx as tx_router

load_dotenv()

app = FastAPI(title="Hackathon Backend")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1):\d+$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Session for OAuth state
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret")
app.add_middleware(
    SessionMiddleware,
    secret_key=SESSION_SECRET,
    same_site="lax",
    https_only=False,
    session_cookie="oauth_session",
    max_age=60 * 60 * 24,
)


@app.get("/health")
def health():
    return {"ok": True}


# Routers
app.include_router(waiting_list.router)
app.include_router(auth.router)
app.include_router(user_router.router)
app.include_router(paypal_api_router.router)
app.include_router(paypal_link_api.router)
app.include_router(ramp_router.router)
app.include_router(tx_router.router)
