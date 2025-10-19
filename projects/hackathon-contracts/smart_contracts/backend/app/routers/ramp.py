from __future__ import annotations

import time
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field, EmailStr

from app.core.firebase import get_firestore_client
from app.routers.auth import get_current_user
from app.algorand_usdc import (
    mint_and_send_usdc_dev,
    _ensure_usdc_dev,
    _opt_in_if_needed,
)
from app.algorand import get_or_create_local_account  # <- your existing helper

router = APIRouter(prefix="/api/ramp", tags=["ramp"])
USERS = lambda: get_firestore_client().collection("users")

# ─────────────────────────────────────────────────────────────
# Quote (mock)
# ─────────────────────────────────────────────────────────────


class QuoteIn(BaseModel):
    usd: str = Field(..., pattern=r"^\d+(\.\d{1,2})?$")


class QuoteOut(BaseModel):
    usd: str
    algo: str
    usdc: str
    rates: dict


@router.post("/quote", response_model=QuoteOut)
def quote(payload: QuoteIn, user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "not authenticated")

    usd = float(payload.usd)
    usd_per_algo = 0.20
    usdc_per_algo = 1.00
    slippage = 0.001

    algo_amt = usd / usd_per_algo
    usdc_amt = usd

    return {
        "usd": f"{usd:.2f}",
        "algo": f"{algo_amt:.6f}",
        "usdc": f"{usdc_amt:.2f}",
        "rates": {
            "usd_per_algo": f"{usd_per_algo:.4f}",
            "usdc_per_algo": f"{usdc_per_algo:.2f}",
            "slippage": f"{slippage:.3f}",
        },
    }


# ─────────────────────────────────────────────────────────────
# Fiat -> ALGO -> USDC-DEV deposit to *user's* wallet
# ─────────────────────────────────────────────────────────────


class MintIn(BaseModel):
    usd: str = Field(..., pattern=r"^\d+(\.\d{1,2})?$")
    # Optional: override deposit wallet (defaults to current user's wallet)
    to_wallet: Optional[str] = None
    recipient_paypal_email: Optional[EmailStr] = None
    order_id: Optional[str] = None


@router.post("/fiat-to-usdc")
def fiat_to_usdc(payload: MintIn, user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "not authenticated")

    # Resolve payer PayPal (for receipt metadata)
    doc = USERS().document(user["email"]).get().to_dict() or {}
    payer_pp = doc.get("paypalEmail") if doc.get("paypalLinked") else None

    # Resolve the *user* wallet and signer (provisioned at auth time)
    acct = get_or_create_local_account(user["email"])  # has .address & .signer
    user_wallet_addr = payload.to_wallet or acct.address

    # Ensure the user wallet is opted-in to USDC-DEV
    asset_id = _ensure_usdc_dev()
    _opt_in_if_needed(user_wallet_addr, acct.signer.private_key, asset_id)

    # Quote math (same as /quote)
    usd = float(payload.usd)
    usd_per_algo = 0.20
    algo_amt = usd / usd_per_algo
    usdc_amt = usd

    receipt = {
        "payer": {"email": user["email"], "paypal": payer_pp},
        "recipient": {
            "wallet": user_wallet_addr,
            "paypal": payload.recipient_paypal_email,
        },
        "payment": {
            "kind": "fiat->ALGO->USDC",
            "usd": f"{usd:.2f}",
            "algo": f"{algo_amt:.6f}",
            "usdc": f"{usdc_amt:.2f}",
            "order_id": payload.order_id,
        },
        "quote": {
            "usd_per_algo": f"{usd_per_algo:.4f}",
            "usdc_per_algo": "1.00",
            "slippage": "0.001",
        },
    }

    # Mint from treasury and send to the *user* wallet with on-chain note
    res = mint_and_send_usdc_dev(
        to_addr=user_wallet_addr,
        usdc_units=f"{usdc_amt:.2f}",
        receipt=receipt,
    )

    return {
        "ok": True,
        "txid": res["txid"],
        "asset_id": res["asset_id"],
        "amount": f"{usdc_amt:.2f}",
        "decimals": res["decimals"],
        "note": receipt,
    }
