from __future__ import annotations
import os
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr

from app.core.firebase import get_firestore_client

router = APIRouter(tags=["waitlist"])


def get_waitlist_collection():
    coll_name = os.getenv("FIREBASE_COLLECTION", "waitlist")
    return get_firestore_client().collection(coll_name)


class SubscribeIn(BaseModel):
    email: EmailStr


class SubscribeOut(BaseModel):
    ok: bool
    already: bool = False
    message: Optional[str] = None


@router.post("/subscribe", response_model=SubscribeOut)
async def subscribe(req: Request, payload: SubscribeIn):
    email = payload.email.strip().lower()
    ip = req.client.host if req.client else None
    now = datetime.now(timezone.utc).isoformat()

    coll = get_waitlist_collection()
    doc_ref = coll.document(email)

    try:
        snap = doc_ref.get()
        if snap.exists:
            doc_ref.set({"updatedAt": now, "lastIp": ip}, merge=True)
            return SubscribeOut(ok=True, already=True, message="Already subscribed")

        doc_ref.set(
            {
                "email": email,
                "createdAt": now,
                "updatedAt": now,
                "ip": ip,
                "source": "landing",
            },
            merge=False,
        )
        return SubscribeOut(ok=True, already=False, message="Subscribed")
    except Exception as e:
        raise HTTPException(status_code=500, detail="Failed to subscribe") from e
