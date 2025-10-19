from __future__ import annotations

import os
import time
import uuid
from typing import Any, Dict, Optional
import requests


# ────────────────────────────────────────────────────────────────
# Config
# ────────────────────────────────────────────────────────────────

PAYPAL_API = os.getenv("PAYPAL_API", "https://api-m.sandbox.paypal.com")
PAYPAL_CLIENT_ID = os.getenv("PAYPAL_CLIENT_ID", "")
PAYPAL_CLIENT_SECRET = os.getenv("PAYPAL_CLIENT_SECRET", "")
TIMEOUT = 20  # seconds

if not PAYPAL_CLIENT_ID or not PAYPAL_CLIENT_SECRET:
    # Fail fast in dev if creds aren’t set
    raise RuntimeError("Missing PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET env vars")


# ────────────────────────────────────────────────────────────────
# Token cache (in-memory)
# ────────────────────────────────────────────────────────────────

_token_cache: Dict[str, Any] = {
    "access_token": None,
    "expires_at": 0,  # epoch seconds
}


def _now() -> int:
    return int(time.time())


def _get_app_token() -> str:
    """
    Client Credentials token. Cached in memory until ~2 min before expiry.
    """
    # reuse if valid for at least 120s more
    if _token_cache["access_token"] and _now() < (_token_cache["expires_at"] - 120):
        return _token_cache["access_token"]

    r = requests.post(
        f"{PAYPAL_API}/v1/oauth2/token",
        auth=(PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET),
        data={"grant_type": "client_credentials"},
        headers={"Accept": "application/json"},
        timeout=TIMEOUT,
    )
    if r.status_code != 200:
        raise RuntimeError(f"PayPal token error {r.status_code}: {r.text[:500]}")
    data = r.json()
    _token_cache["access_token"] = data["access_token"]
    _token_cache["expires_at"] = _now() + int(data.get("expires_in", 0))
    return _token_cache["access_token"]


# ────────────────────────────────────────────────────────────────
# Low-level request helper
# ────────────────────────────────────────────────────────────────


def _pp_request(
    method: str,
    path: str,
    *,
    json: Optional[dict] = None,
    params: Optional[dict] = None,
    idempotency_key: Optional[str] = None,
) -> dict:
    """
    Makes an authenticated PayPal API call with the app token.
    """
    token = _get_app_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    if idempotency_key:
        headers["PayPal-Request-Id"] = idempotency_key

    url = f"{PAYPAL_API}{path}"
    r = requests.request(
        method,
        url,
        json=json,
        params=params,
        headers=headers,
        timeout=TIMEOUT,
    )

    # 200/201/202 are all common "success" responses
    if r.status_code >= 400:
        dbg = r.headers.get("paypal-debug-id", "")
        raise RuntimeError(
            f"PayPal {method} {path} failed {r.status_code}: {r.text[:800]} "
            f"{'(debug-id: ' + dbg + ')' if dbg else ''}"
        )

    if not r.text:
        return {}
    return r.json()


# ────────────────────────────────────────────────────────────────
# INBOUND (Top-up) — Checkout Orders
# ────────────────────────────────────────────────────────────────


def create_order(
    amount: str,
    *,
    currency: str = "USD",
    intent: str = "CAPTURE",
    description: Optional[str] = None,
) -> dict:
    """
    Create a PayPal order to be approved by the user in the browser.
    Returns the full order object (contains id + approve link).
    """
    payload = {
        "intent": intent,
        "purchase_units": [
            {
                "amount": {"currency_code": currency, "value": amount},
            }
        ],
        "application_context": {
            "brand_name": "RAD Demo",
            "shipping_preference": "NO_SHIPPING",
            "user_action": "PAY_NOW",
        },
    }
    if description:
        payload["purchase_units"][0]["description"] = description

    # Optional idempotency key for order creation
    return _pp_request(
        "POST",
        "/v2/checkout/orders",
        json=payload,
        idempotency_key=str(uuid.uuid4()),
    )


def capture_order(order_id: str) -> dict:
    """
    Finalize (capture) a previously approved order.
    """
    return _pp_request(
        "POST",
        f"/v2/checkout/orders/{order_id}/capture",
        idempotency_key=str(uuid.uuid4()),
    )


def get_order(order_id: str) -> dict:
    """
    Fetch an order (useful for debugging state during the demo).
    """
    return _pp_request("GET", f"/v2/checkout/orders/{order_id}")


# ────────────────────────────────────────────────────────────────
# OUTBOUND (Cash-out) — Payouts API
# ────────────────────────────────────────────────────────────────


def create_payout(
    receiver_email: str,
    amount: str,
    *,
    currency: str = "USD",
    note: Optional[str] = None,
    sender_batch_id: Optional[str] = None,
    sender_item_id: Optional[str] = None,
) -> dict:
    """
    Sends a single payout to a PayPal email (sandbox personal account).
    Returns the payout batch response (async; poll for completion).
    """
    sender_batch_id = sender_batch_id or str(uuid.uuid4())
    sender_item_id = sender_item_id or str(uuid.uuid4())

    payload = {
        "sender_batch_header": {
            "sender_batch_id": sender_batch_id,
            "email_subject": "You have a payout",
            "email_message": "You received a payout via RAD demo.",
        },
        "items": [
            {
                "recipient_type": "EMAIL",
                "receiver": receiver_email,
                "amount": {"value": amount, "currency": currency},
                "note": note or "Thanks for testing 🤝",
                "sender_item_id": sender_item_id,
            }
        ],
    }

    # Payouts often return 201 with details (async processing)
    return _pp_request(
        "POST",
        "/v1/payments/payouts",
        json=payload,
        idempotency_key=sender_batch_id,
    )


def get_payout_batch(batch_id: str) -> dict:
    """
    Lookup a payout batch by batch_id (from create_payout response).
    """
    return _pp_request("GET", f"/v1/payments/payouts/{batch_id}")


def get_payout_item(item_id: str) -> dict:
    """
    Lookup an individual payout item by item_id.
    """
    return _pp_request("GET", f"/v1/payments/payouts-item/{item_id}")


# ────────────────────────────────────────────────────────────────
# Utility
# ────────────────────────────────────────────────────────────────


def get_app_token_for_debug() -> str:
    """
    For manual testing/debug routes only.
    """
    return _get_app_token()
