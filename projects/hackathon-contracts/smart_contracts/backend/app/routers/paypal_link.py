# app/routers/paypal_link.py
from __future__ import annotations

import time
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from app.core.firebase import get_firestore_client, init_firebase_admin

# If you already have an auth dependency, import it; otherwise adapt this.
# It must return a dict with at least {"email": "..."} when logged in.
from app.routers.auth import get_current_user  # adjust path if different

router = APIRouter(prefix="/api/paypal", tags=["paypal"])

USERS = lambda: get_firestore_client().collection("users")


class ConnectIn(BaseModel):
    paypal_email: EmailStr


@router.get("/status")
def paypal_status(user=Depends(get_current_user)):
    """
    Return PayPal link status for the logged-in user.
    """
    if not user:
        raise HTTPException(401, "not authenticated")
    init_firebase_admin()
    doc = USERS().document(user["email"]).get().to_dict() or {}
    linked = bool(doc.get("paypalLinked"))
    email = doc.get("paypalEmail")
    role = doc.get("paypalRole")  # e.g., "merchant" for demo
    return {"linked": linked, "email": email, "role": role}


@router.post("/connect")
def paypal_connect(payload: ConnectIn, user=Depends(get_current_user)):
    """
    Demo-style linking: accept a sandbox PayPal email and mark the user
    as a 'Radcliffe merchant' in Firestore.
    """
    if not user:
        raise HTTPException(401, "not authenticated")
    init_firebase_admin()

    USERS().document(user["email"]).set(
        {
            "paypalLinked": True,
            "paypalEmail": payload.paypal_email.lower().strip(),
            "paypalRole": "merchant",  # <= treat as Radcliffe merchant (demo)
            "paypalLinkedAt": time.time(),
        },
        merge=True,
    )
    return {"ok": True, "email": payload.paypal_email}
