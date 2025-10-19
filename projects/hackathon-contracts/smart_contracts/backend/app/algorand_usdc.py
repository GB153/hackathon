from __future__ import annotations

import json
import time
import hashlib
from typing import Optional, Any, Dict

from algosdk import transaction
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
    TransactionWithSigner,
)

from app.algorand import get_algorand_client, get_account_manager
from app.core.firebase import get_firestore_client
from app.binance import spot_market_buy_usdc_with_usdt, find_usdcusdt_symbol

# ─────────────────────────────────────────────────────────────
# Firestore helpers
# ─────────────────────────────────────────────────────────────

SYSDOC = lambda: get_firestore_client().collection("__sys").document("USDC")
RECEIPTS = lambda: get_firestore_client().collection("receipts")

# ─────────────────────────────────────────────────────────────
# ASA config
# ─────────────────────────────────────────────────────────────

USDC_DECIMALS = 6  # like real USDC
USDC_UNIT = "USDC"
USDC_NAME = "USDC"

NOTE_LIMIT = 1024  # Algorand hard cap
NOTE_NS = "rad/ramp"  # a tiny namespace string for the note


def _now() -> float:
    return float(time.time())


# ─────────────────────────────────────────────────────────────
# Note encoding: compact on-chain + off-chain full receipt
# ─────────────────────────────────────────────────────────────


def _minify(obj: Any) -> bytes:
    return json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _hash_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def encode_receipt_note(receipt_full: dict) -> tuple[bytes, str]:
    """
    Build a compact on-chain note (<= 1024 bytes) and return (note_bytes, content_hash).
    The content_hash is SHA-256 of the minified full receipt (hex).
    """
    full_min = _minify(receipt_full)
    h = _hash_bytes(full_min)

    # Minimal human-useful fields
    # Keep keys short to save bytes.
    try:
        usd = receipt_full["payment"]["usd"]
    except Exception:
        usd = None
    try:
        usdc = receipt_full["payment"]["usdc_bought"]
    except Exception:
        usdc = None
    try:
        sym = receipt_full["exchange"]["symbol"]
    except Exception:
        sym = None
    try:
        px = receipt_full["exchange"]["effective_price_usdt_per_usdc"]
    except Exception:
        px = None
    try:
        to_wallet = receipt_full["recipient"]["wallet"]
    except Exception:
        to_wallet = None
    try:
        order_id = receipt_full.get("binance", {}).get("orderId")
    except Exception:
        order_id = None

    minimal = {
        "k": NOTE_NS,  # namespace
        "v": 1,  # schema version
        "h": h[:32],  # short hash for UI lookups; full hash still stored in Firestore
        "usd": usd,
        "usdc": usdc,
        "sym": sym,
        "px": px,
        "to": to_wallet,
        "oid": order_id,
    }

    note = _minify(minimal)
    if len(note) <= NOTE_LIMIT:
        return note, h

    # Progressive trimming if somehow still large
    for key in ("px", "sym", "usdc", "usd", "to", "oid"):
        minimal.pop(key, None)
        note = _minify(minimal)
        if len(note) <= NOTE_LIMIT:
            return note, h

    # Absolute fallback: only pointer
    pointer_only = {"k": NOTE_NS, "v": 1, "h": h[:32]}
    return _minify(pointer_only), h


def _save_full_receipt(txid: str, content_hash: str, receipt_full: dict):
    """
    Persist the full receipt off-chain so the UI can retrieve by hash/txid.
    """
    try:
        RECEIPTS().document(txid).set(
            {
                "hash": content_hash,
                "txid": txid,
                "ts": int(time.time()),
                "receipt": receipt_full,
            },
            merge=True,
        )
        # Also store by hash (helpful for quick lookup)
        RECEIPTS().document(content_hash).set(
            {
                "hash": content_hash,
                "txid": txid,
                "ts": int(time.time()),
                "receipt": receipt_full,
            },
            merge=True,
        )
    except Exception:
        # Don't fail the request if Firestore write has issues.
        pass


# ─────────────────────────────────────────────────────────────
# ASA lifecycle
# ─────────────────────────────────────────────────────────────


def _ensure_usdc_dev() -> int:
    """
    Ensure a demo USDC ASA exists on LocalNet. Returns asset_id.
    Stores { assetId } in Firestore __sys/USDC.
    """
    sysdoc_ref = SYSDOC()
    doc = sysdoc_ref.get().to_dict() or {}
    if doc.get("assetId"):
        return int(doc["assetId"])

    algo = get_algorand_client()
    algod = algo.client.algod
    am = get_account_manager()
    creator = am.localnet_dispenser()  # use dispenser as ASA creator

    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = max(sp.min_fee, 1000)

    txn = transaction.AssetConfigTxn(
        sender=creator.address,
        sp=sp,
        total=10_000_000_000_000,  # 10T min-units (10,000,000 USDC with 6 dp)
        default_frozen=False,
        unit_name=USDC_UNIT,
        asset_name=USDC_NAME,
        manager=creator.address,
        reserve=creator.address,
        freeze=creator.address,
        clawback=creator.address,
        decimals=USDC_DECIMALS,
    )
    stx = txn.sign(creator.signer.private_key)
    txid = algod.send_transaction(stx)
    transaction.wait_for_confirmation(algod, txid, 4)
    info = algod.pending_transaction_info(txid)
    asset_id = info["asset-index"]

    try:
        sysdoc_ref.set({"assetId": asset_id, "createdAt": _now()}, merge=True)
    except Exception:
        pass

    return asset_id


def _opt_in_if_needed(address: str, signer_sk: bytes, asset_id: int):
    """
    Opt-in the account at `address` to `asset_id` by signing with `signer_sk`.
    No-op if already opted-in.
    """
    algo = get_algorand_client()
    algod = algo.client.algod

    try:
        info = algod.account_asset_info(address, asset_id)
        if info and "asset-holding" in info:
            return
    except Exception:
        pass  # not opted-in or not holding

    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = max(sp.min_fee, 1000)

    optin = transaction.AssetTransferTxn(
        sender=address,
        sp=sp,
        receiver=address,
        amt=0,
        index=asset_id,
    )
    stx = optin.sign(signer_sk)
    txid = algod.send_transaction(stx)
    transaction.wait_for_confirmation(algod, txid, 4)


# ─────────────────────────────────────────────────────────────
# Transfer + mint
# ─────────────────────────────────────────────────────────────


def _send_usdc_dev(
    sender_addr: str,
    sender_sk: bytes,
    to_addr: str,
    asset_id: int,
    amt_min_units: int,
    note_json: dict,
) -> tuple[str, str]:
    """
    Sends ASA and returns (txid, content_hash). Ensures note <= 1024 bytes.
    """
    algo = get_algorand_client()
    algod = algo.client.algod

    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = max(sp.min_fee, 1000)

    note_bytes, content_hash = encode_receipt_note(note_json)

    txn = transaction.AssetTransferTxn(
        sender=sender_addr,
        sp=sp,
        receiver=to_addr,
        amt=amt_min_units,
        index=asset_id,
        note=note_bytes,
    )

    atc = AtomicTransactionComposer()
    atc.add_transaction(TransactionWithSigner(txn, AccountTransactionSigner(sender_sk)))
    res = atc.execute(algod, 4)
    txid = res.tx_ids[0]
    return txid, content_hash


def _units_to_min_units(units_str: str) -> int:
    """
    Convert string units like '12.34' to min-units respecting USDC_DECIMALS.
    """
    parts = units_str.split(".")
    whole = int(parts[0]) if parts[0] else 0
    frac = (parts[1] if len(parts) > 1 else "").ljust(USDC_DECIMALS, "0")[
        :USDC_DECIMALS
    ]
    return whole * (10**USDC_DECIMALS) + (int(frac) if frac else 0)


def mint_and_send_usdc_dev(to_addr: str, usdc_units: str, receipt: dict) -> dict:
    """
    Mints (from the creator treasury) and sends USDC to `to_addr`.
    Embeds a compact JSON receipt into the transfer note (public, on-chain),
    and saves the full receipt off-chain in Firestore keyed by hash + txid.
    `usdc_units` is a string like "12.34" in asset units.
    """
    asset_id = _ensure_usdc_dev()

    # Use dispenser as "treasury" for demo
    am = get_account_manager()
    treasury = am.localnet_dispenser()

    # Ensure treasury is opted-in (some SDKs require it too)
    _opt_in_if_needed(treasury.address, treasury.signer.private_key, asset_id)

    min_units = _units_to_min_units(usdc_units)

    # Envelope that goes into hashing + compact note
    envelope = {
        "type": "rad/ramp-receipt",
        "asset": {
            "id": asset_id,
            "name": USDC_NAME,
            "unit": USDC_UNIT,
            "decimals": USDC_DECIMALS,
        },
        "ts": int(time.time()),
        **receipt,
    }

    txid, content_hash = _send_usdc_dev(
        sender_addr=treasury.address,
        sender_sk=treasury.signer.private_key,
        to_addr=to_addr,
        asset_id=asset_id,
        amt_min_units=min_units,
        note_json=envelope,
    )

    # Persist full receipt off-chain for rich UI / audit
    _save_full_receipt(txid, content_hash, envelope)

    return {
        "txid": txid,
        "asset_id": asset_id,
        "amount_min_units": min_units,
        "decimals": USDC_DECIMALS,
        "hash": content_hash,
    }


# -----------------------------
# Spot testnet buy -> LocalNet mint & send
# -----------------------------
def buy_usdc_on_testnet_and_send_localnet(
    to_addr: str,
    spend_usdt: float,
    extra_receipt: Optional[dict] = None,
) -> dict:
    """
    1) Spot MARKET buy USDC with USDT on Binance Spot Testnet (quoteOrderQty=spend_usdt)
    2) Mint & send the *dev* USDC ASA on LocalNet for the filled USDC amount.
    3) Return a combined receipt (Binance + on-chain).
    """
    # ---- 1) Execute MARKET buy (testnet) ----
    order = spot_market_buy_usdc_with_usdt(spend_usdt)

    # Extract executed base qty (USDC) & spent quote (USDT)
    executed_qty_str = order.get("executedQty") or "0"
    quote_spent_str = order.get("cummulativeQuoteQty") or f"{spend_usdt:.6f}"

    # Fallback to fills sum if needed
    try:
        if executed_qty_str == "0" and order.get("fills"):
            executed_qty = sum(float(f.get("qty", "0")) for f in order["fills"])
            executed_qty_str = f"{executed_qty:.6f}"
    except Exception:
        pass

    symbol = "USDCUSDT"
    try:
        symbol = find_usdcusdt_symbol()
    except Exception:
        pass

    binance_meta = {
        "mode": "spot-testnet",
        "symbol": symbol,
        "orderId": order.get("orderId"),
        "clientOrderId": order.get("clientOrderId"),
        "status": order.get("status", "FILLED"),
        "transactTime": order.get("transactTime"),
        "executedQty": executed_qty_str,  # USDC bought (string)
        "cummulativeQuoteQty": quote_spent_str,  # USDT spent (string)
        "origType": order.get("type"),
        "side": order.get("side"),
    }

    envelope = {"binance": binance_meta}
    if extra_receipt:
        envelope.update(extra_receipt)

    # ---- 2) Mint & send dev ASA on LocalNet using the filled USDC ----
    onchain = mint_and_send_usdc_dev(
        to_addr=to_addr,
        usdc_units=executed_qty_str,  # already a base-asset amount string
        receipt=envelope,
    )

    # ---- 3) Return a combined result ----
    return {
        "binance_order": binance_meta,
        "onchain": onchain,  # { txid, asset_id, amount_min_units, decimals, hash }
    }
