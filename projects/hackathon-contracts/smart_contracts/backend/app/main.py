from __future__ import annotations

import os
from datetime import datetime, timezone
from functools import lru_cache
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr

load_dotenv()

app = FastAPI(title="Hackathon Backend")

# Allow Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Firestore helpers ----------


@lru_cache
def get_firestore_client():
    """
    Lazy init Firestore client; relies on:
      - GOOGLE_APPLICATION_CREDENTIALS (path to service account JSON), and
      - FIREBASE_PROJECT_ID
    """
    from google.cloud import firestore  # type: ignore

    project_id = os.getenv("FIREBASE_PROJECT_ID")
    if not project_id:
        raise RuntimeError("FIREBASE_PROJECT_ID is not set")
    return firestore.Client(project=project_id)


def get_waitlist_collection():
    coll_name = os.getenv("FIREBASE_COLLECTION", "waitlist")
    return get_firestore_client().collection(coll_name)


# ---------- Models ----------


class SubscribeIn(BaseModel):
    email: EmailStr


class SubscribeOut(BaseModel):
    ok: bool
    already: bool = False
    message: Optional[str] = None


# ---------- Routes ----------


@app.get("/health")
def health():
    return {"ok": True}


@app.post("/subscribe", response_model=SubscribeOut)
async def subscribe(req: Request, payload: SubscribeIn):
    """
    Idempotent subscribe endpoint.
    Uses lowercased email as the document ID, so duplicate inserts are prevented.
    """
    email = payload.email.strip().lower()
    ip = req.client.host if req.client else None
    now = datetime.now(timezone.utc).isoformat()

    coll = get_waitlist_collection()
    doc_ref = coll.document(email)  # email as doc id guarantees uniqueness

    try:
        snap = doc_ref.get()
        if snap.exists:
            # Update 'updatedAt' for bookkeeping, but mark as already subscribed
            doc_ref.set({"updatedAt": now, "lastIp": ip}, merge=True)
            return SubscribeOut(ok=True, already=True, message="Already subscribed")

        # New subscriber
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
        # Optionally log e
        raise HTTPException(status_code=500, detail="Failed to subscribe") from e
