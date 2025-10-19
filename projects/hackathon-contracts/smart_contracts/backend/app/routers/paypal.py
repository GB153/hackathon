from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field, EmailStr

from app.utils.paypal import (
    create_order,
    capture_order,
    create_payout,
    get_app_token_for_debug,
    get_order,
    get_payout_batch,
    get_payout_item,
)

router = APIRouter(prefix="/api/paypal", tags=["paypal"])


# ---------- Models ----------


class OrderCreateIn(BaseModel):
    # Pydantic v2: use pattern= instead of regex=
    amount: str = Field(..., pattern=r"^\d+(\.\d{1,2})?$")
    currency: str = "USD"
    description: Optional[str] = None


class PayoutIn(BaseModel):
    email: EmailStr
    amount: str = Field(..., pattern=r"^\d+(\.\d{1,2})?$")
    currency: str = "USD"
    note: Optional[str] = None


# ---------- Orders (Inbound / Top-up) ----------


@router.post("/orders")
def api_create_order(payload: OrderCreateIn):
    try:
        return create_order(
            amount=payload.amount,
            currency=payload.currency,
            description=payload.description,
        )
    except Exception as e:
        raise HTTPException(502, f"create_order failed: {e}")


@router.get("/orders/{order_id}")
def api_get_order(order_id: str):
    try:
        return get_order(order_id)
    except Exception as e:
        raise HTTPException(502, f"get_order failed: {e}")


@router.post("/orders/{order_id}/capture")
def api_capture_order(order_id: str):
    try:
        return capture_order(order_id)
    except Exception as e:
        raise HTTPException(502, f"capture_order failed: {e}")


# ---------- Payouts (Outbound / Cash-out) ----------


@router.post("/payouts")
def api_create_payout(payload: PayoutIn):
    try:
        return create_payout(
            receiver_email=payload.email,
            amount=payload.amount,
            currency=payload.currency,
            note=payload.note,
        )
    except Exception as e:
        raise HTTPException(502, f"create_payout failed: {e}")


@router.get("/payouts/batch/{batch_id}")
def api_get_payout_batch(batch_id: str):
    try:
        return get_payout_batch(batch_id)
    except Exception as e:
        raise HTTPException(502, f"get_payout_batch failed: {e}")


@router.get("/payouts/item/{item_id}")
def api_get_payout_item(item_id: str):
    try:
        return get_payout_item(item_id)
    except Exception as e:
        raise HTTPException(502, f"get_payout_item failed: {e}")


# ---------- Debug ----------


@router.get("/token")
def api_debug_token():
    try:
        return {"access_token": get_app_token_for_debug()}
    except Exception as e:
        raise HTTPException(502, f"token fetch failed: {e}")
