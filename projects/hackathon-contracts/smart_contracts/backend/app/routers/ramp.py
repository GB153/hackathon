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
from app.algorand import get_or_create_local_account
from app.binance import (
    spot_market_buy_usdc_with_usdt,
    find_usdcusdt_symbol,
    spot_quote_usdc_from_usd,
)

router = APIRouter(prefix="/api/ramp", tags=["ramp"])
USERS = lambda: get_firestore_client().collection("users")

# ─────────────────────────────────────────────────────────────
# Live spot quote (Binance testnet)
# ─────────────────────────────────────────────────────────────


class SpotQuoteIn(BaseModel):
    usd: str = Field(..., pattern=r"^\d+(\.\d{1,2})?$")


class SpotQuoteOut(BaseModel):
    usd: str
    symbol: str
    venue: str
    price: dict
    expected_usdc: dict
    ts: int


@router.post("/quote", response_model=SpotQuoteOut)
def quote(payload: SpotQuoteIn, user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "not authenticated")
    usd = float(payload.usd)
    try:
        q = spot_quote_usdc_from_usd(usd)
    except Exception as e:
        raise HTTPException(502, f"binance spot quote failed: {e}")
    return {
        "usd": f"{usd:.2f}",
        "symbol": q["symbol"],
        "venue": q["venue"],
        "price": q["price"],
        "expected_usdc": q["expected_usdc"],
        "ts": int(time.time()),
    }


# ─────────────────────────────────────────────────────────────
# Fiat -> Spot (USDT→USDC) -> LocalNet “USDC” ASA mint & send
# ─────────────────────────────────────────────────────────────


class MintIn(BaseModel):
    usd: str = Field(..., pattern=r"^\d+(\.\d{1,2})?$")
    to_wallet: Optional[str] = None
    recipient_paypal_email: Optional[EmailStr] = (
        None  # optional off-ramp intent (for note)
    )
    currency: str = "USD"  # for future PayPal use
    order_id: Optional[str] = None


@router.post("/fiat-to-usdc")
def fiat_to_usdc(payload: MintIn, user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "not authenticated")

    # Payer PayPal (for metadata on-chain)
    doc = USERS().document(user["email"]).get().to_dict() or {}
    payer_pp = doc.get("paypalEmail") if doc.get("paypalLinked") else None

    # Resolve wallet & ASA opt-in
    acct = get_or_create_local_account(user["email"])
    user_wallet_addr = payload.to_wallet or acct.address
    asset_id = _ensure_usdc_dev()
    _opt_in_if_needed(user_wallet_addr, acct.signer.private_key, asset_id)

    usd_amount = float(payload.usd)

    # Optional: include pre-trade spot snapshot in receipt for transparency
    pre_quote = None
    try:
        pre_quote = spot_quote_usdc_from_usd(usd_amount)
    except Exception:
        pre_quote = None

    # 1) MARKET buy on testnet
    try:
        order = spot_market_buy_usdc_with_usdt(usd_amount)
    except Exception as e:
        raise HTTPException(502, f"binance spot buy failed: {e}")

    executed_qty_str = order.get("executedQty") or "0"
    if executed_qty_str == "0" and order.get("fills"):
        try:
            executed_qty = sum(float(f.get("qty", "0")) for f in order["fills"])
            executed_qty_str = f"{executed_qty:.6f}"
        except Exception:
            pass
    try:
        executed_usdc = float(executed_qty_str)
    except Exception:
        executed_usdc = 0.0

    quote_spent_str = order.get("cummulativeQuoteQty") or f"{usd_amount:.6f}"
    try:
        spent_usdt = float(quote_spent_str)
    except Exception:
        spent_usdt = usd_amount

    if executed_usdc <= 0:
        raise HTTPException(502, "order filled quantity is zero")

    price = spent_usdt / executed_usdc
    price_str = f"{price:.6f}"

    try:
        symbol = find_usdcusdt_symbol()
    except Exception:
        symbol = "USDCUSDT"

    # 2) Enriched on-chain receipt
    receipt = {
        "payer": {"email": user["email"], "paypal": payer_pp},
        "recipient": {
            "wallet": user_wallet_addr,
            "paypal": payload.recipient_paypal_email,
        },
        "payment": {
            "kind": "fiat->spot(usdt)->usdc->localnet-usdc",
            "usd": f"{usd_amount:.2f}",
            "usdt_spent": f"{spent_usdt:.6f}",
            "usdc_bought": f"{executed_usdc:.6f}",
            "order_id": payload.order_id,
        },
        "exchange": {
            "name": "binance",
            "venue": "spot-testnet",
            "symbol": symbol,
            "effective_price_usdt_per_usdc": price_str,
        },
        "binance": {
            "mode": "spot-testnet",
            "symbol": symbol,
            "orderId": order.get("orderId"),
            "clientOrderId": order.get("clientOrderId"),
            "status": order.get("status", "FILLED"),
            "transactTime": order.get("transactTime"),
            "executedQty": f"{executed_usdc:.6f}",
            "cummulativeQuoteQty": f"{spent_usdt:.6f}",
            "priceUSDCUSDT": price_str,
            "side": order.get("side"),
            "type": order.get("type"),
        },
    }
    if pre_quote:
        receipt["pre_quote"] = pre_quote  # last/bid/ask + expected_usdc (spot snapshot)

    # 3) Mint & send LocalNet ASA
    onchain = mint_and_send_usdc_dev(
        to_addr=user_wallet_addr,
        usdc_units=f"{executed_usdc:.6f}",
        receipt=receipt,
    )

    return {
        "ok": True,
        "asset_id": onchain["asset_id"],
        "decimals": onchain["decimals"],
        "amount_usdc": f"{executed_usdc:.6f}",
        "txid": onchain["txid"],
        "exchange": receipt["exchange"],
        "binance_order": receipt["binance"],
        "pre_quote": pre_quote,
    }
