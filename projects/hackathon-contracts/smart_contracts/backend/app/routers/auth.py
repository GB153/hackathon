# app/routers/auth.py
from __future__ import annotations

import os
import time
import urllib.parse
from typing import Optional

from fastapi import APIRouter, HTTPException, Request, Response, Depends
from starlette.responses import RedirectResponse, JSONResponse
from authlib.integrations.starlette_client import OAuth
from jose import jwt, JWTError
from pydantic import BaseModel, EmailStr, Field
import bcrypt

from app.core.firebase import init_firebase_admin, get_firestore_client

router = APIRouter(tags=["auth"])

# -------------------------------------------------------------------
# Config
# -------------------------------------------------------------------
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173")
REDIRECT_URI = os.getenv(
    "OAUTH_REDIRECT_URI", "http://127.0.0.1:8000/auth/google/callback"
)
SESSION_SECRET = os.getenv("SESSION_SECRET", "dev-secret")
SESSION_COOKIE_NAME = "session"
SESSION_COOKIE_DOMAIN = os.getenv("SESSION_COOKIE_DOMAIN")  # optional in dev
SESSION_TTL_SECONDS = 60 * 60 * 24 * 7  # 7 days

# -------------------------------------------------------------------
# OAuth client (Google OpenID Connect)
# -------------------------------------------------------------------
oauth = OAuth()
oauth.register(
    name="google",
    server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
    client_id=os.getenv("GOOGLE_OAUTH_CLIENT_ID"),
    client_secret=os.getenv("GOOGLE_OAUTH_CLIENT_SECRET"),
    client_kwargs={"scope": "openid email profile"},
)


# -------------------------------------------------------------------
# Firestore helpers
# -------------------------------------------------------------------
def users_coll():
    return get_firestore_client().collection("users")


def user_doc(email: str):
    return users_coll().document(email.lower().strip())


# -------------------------------------------------------------------
# Session helpers (signed JWT in HttpOnly cookie)
# -------------------------------------------------------------------
def create_session_token(
    email: str, sub: Optional[str], name: Optional[str], picture: Optional[str]
) -> str:
    now = int(time.time())
    payload = {
        "iss": "hackathon-backend",
        "aud": "hackathon-frontend",
        "iat": now,
        "exp": now + SESSION_TTL_SECONDS,
        "email": email,
        "sub": sub,
        "name": name,
        "picture": picture,
    }
    return jwt.encode(payload, SESSION_SECRET, algorithm="HS256")


def read_session_token(token: str) -> dict:
    return jwt.decode(
        token, SESSION_SECRET, algorithms=["HS256"], audience="hackathon-frontend"
    )


def set_session_cookie(resp: Response, token: str):
    resp.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=token,
        max_age=SESSION_TTL_SECONDS,
        secure=False,  # set True in production behind HTTPS
        httponly=True,
        samesite="lax",
        domain=SESSION_COOKIE_DOMAIN,  # None in dev
        path="/",
    )


def clear_session_cookie(resp: Response):
    resp.delete_cookie(key=SESSION_COOKIE_NAME, domain=SESSION_COOKIE_DOMAIN, path="/")


# Dependency to fetch current user (if any)
def get_current_user(request: Request) -> Optional[dict]:
    token = request.cookies.get(SESSION_COOKIE_NAME)
    if not token:
        return None
    try:
        return read_session_token(token)
    except JWTError:
        return None


# -------------------------------------------------------------------
# Models for email/password
# -------------------------------------------------------------------
class PasswordSignupIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class PasswordLoginIn(BaseModel):
    email: EmailStr
    password: str


# -------------------------------------------------------------------
# Email/Password: SIGNUP
# -------------------------------------------------------------------
@router.post("/auth/signup")
def password_signup(payload: PasswordSignupIn):
    """
    Create a user with email/password.
    - Fails with 409 if a user already exists (either password or Google).
    - On success, sets session cookie and returns {"ok": True}.
    """
    init_firebase_admin()
    email = payload.email.lower().strip()

    doc_ref = user_doc(email)
    snap = doc_ref.get()
    if snap.exists:
        # If they already exist (with password or via Google), block duplicate creation for now.
        raise HTTPException(status_code=409, detail="User already exists")

    pw_hash = bcrypt.hashpw(
        payload.password.encode("utf-8"), bcrypt.gensalt(rounds=12)
    ).decode("utf-8")
    now = time.time()

    doc_ref.set(
        {
            "email": email,
            "passwordHash": pw_hash,
            "provider": "password",
            "createdAt": now,
            "updatedAt": now,
        },
        merge=False,
    )

    token = create_session_token(email=email, sub=None, name=None, picture=None)
    resp = JSONResponse({"ok": True})
    set_session_cookie(resp, token)
    return resp


# -------------------------------------------------------------------
# Email/Password: LOGIN
# -------------------------------------------------------------------
@router.post("/auth/login")
def password_login(payload: PasswordLoginIn):
    """
    Verify email/password and set session cookie.
    - 401 if user not found or password mismatch.
    """
    init_firebase_admin()
    email = payload.email.lower().strip()

    snap = user_doc(email).get()
    if not snap.exists:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    data = snap.to_dict() or {}
    stored_hash = (data.get("passwordHash") or "").encode("utf-8")
    if not stored_hash or not bcrypt.checkpw(
        payload.password.encode("utf-8"), stored_hash
    ):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = create_session_token(
        email=email,
        sub=data.get("googleSub"),
        name=data.get("name"),
        picture=data.get("picture"),
    )
    resp = JSONResponse({"ok": True})
    set_session_cookie(resp, token)
    return resp


# -------------------------------------------------------------------
# Google OAuth (works for both first-time signup & returning login)
# -------------------------------------------------------------------

# --- Google OAuth (works for both first-time signup & returning login) ---


@router.get("/auth/google/login")
async def google_login(request: Request, next: Optional[str] = None):
    """
    Redirects the browser to Google.
    IMPORTANT: redirect_uri must match Google Console EXACTLY.
    We store ?next= in the server session instead of appending it to redirect_uri.
    """
    # Save desired post-login redirect path in the session
    if next:
        request.session["oauth_next"] = next
    else:
        request.session.pop("oauth_next", None)

    # MUST be exactly the value registered in Google Console (no query params)
    cb = REDIRECT_URI
    return await oauth.google.authorize_redirect(request, cb)


@router.get("/auth/google/callback")
async def google_callback(request: Request):
    """
    Exchange code, upsert user in Firestore, mint session cookie, and redirect to the frontend.
    """
    try:
        token = await oauth.google.authorize_access_token(request)
        userinfo = token.get("userinfo")
        if not userinfo:
            userinfo = await oauth.google.userinfo(token=token)

        email = (userinfo.get("email") or "").lower().strip()
        sub = userinfo.get("sub")
        name = userinfo.get("name")
        picture = userinfo.get("picture")

        if not email:
            raise HTTPException(status_code=400, detail="No email from provider")

        init_firebase_admin()
        users_coll().document(email).set(
            {
                "email": email,
                "googleSub": sub,
                "name": name,
                "picture": picture,
                "updatedAt": time.time(),
                "provider": "google",
            },
            merge=True,
        )

        session_token = create_session_token(
            email=email, sub=sub, name=name, picture=picture
        )

        # Pull next from the session (default back to /login)
        next_param = request.session.pop("oauth_next", f"{FRONTEND_ORIGIN}/dashboard")

        resp = RedirectResponse(url=f"{next_param}?ok=1", status_code=302)
        set_session_cookie(resp, session_token)
        return resp

    except Exception as e:
        print("OAuth error:", e)
        return RedirectResponse(
            url=f"{FRONTEND_ORIGIN}/login?error=oauth_failed", status_code=302
        )
