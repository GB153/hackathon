from __future__ import annotations

import os
from typing import Optional

from fastapi import APIRouter, Depends, Request
from starlette.responses import JSONResponse

from app.core.firebase import init_firebase_admin
from app.routers.auth import get_current_user
from app.routers.auth import user_doc

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me")
def users_me(user=Depends(get_current_user)):
    """
    Returns the current session user (from cookie/JWT) and their Firestore profile doc.
    {
      ok: bool,
      user: { email, name, picture, ... } | null,     # from the JWT
      profile: { ... } | null                         # from Firestore users/{email}
    }
    """
    if not user:
        return {"ok": False, "user": None, "profile": None}

    init_firebase_admin()
    email = (user.get("email") or "").lower().strip()
    if not email:
        return {"ok": False, "user": None, "profile": None}

    snap = user_doc(email).get()
    profile = snap.to_dict() if snap.exists else None

    return {"ok": True, "user": user, "profile": profile}


@router.post("/logout")
def users_logout():
    """
    Mirror /auth/logout here for convenience (optional).
    """
    from app.routers.auth import clear_session_cookie

    resp = JSONResponse({"ok": True})
    clear_session_cookie(resp)
    return resp
