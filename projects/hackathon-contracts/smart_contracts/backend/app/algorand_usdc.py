from __future__ import annotations

import json
import time
from typing import Optional

from algosdk import transaction, encoding as algo_encoding
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
    TransactionWithSigner,
)

from app.algorand import get_algorand_client, get_account_manager
from app.core.firebase import get_firestore_client
from app.binance import spot_market_buy_usdc_with_usdt, find_usdcusdt_symbol

SYSDOC = lambda: get_firestore_client().collection("__sys").document("USDC")

USDC_DECIMALS = 6  # like real USDC
USDC_UNIT = "USDC"
USDC_NAME = "USDC"


def _now() -> float:
    return float(time.time())


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
        total=10_000_000_000_000,  # 10T min-units (10,000,000 USDC with 6 dp) — plenty for demo
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
        # If we can fetch, we consider it opted-in; API raises if not opted-in
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


def _send_usdc_dev(
    sender_addr: str,
    sender_sk: bytes,
    to_addr: str,
    asset_id: int,
    amt_min_units: int,
    note_json: dict,
) -> str:
    algo = get_algorand_client()
    algod = algo.client.algod

    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = max(sp.min_fee, 1000)

    note = json.dumps(note_json, separators=(",", ":")).encode("utf-8")

    txn = transaction.AssetTransferTxn(
        sender=sender_addr,
        sp=sp,
        receiver=to_addr,
        amt=amt_min_units,
        index=asset_id,
        note=note,
    )
    stx = txn.sign(sender_sk)

    atc = AtomicTransactionComposer()
    atc.add_transaction(TransactionWithSigner(txn, AccountTransactionSigner(sender_sk)))
    res = atc.execute(algod, 4)
    return res.tx_ids[0]


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
    Embeds a JSON receipt into the transfer note (public, on-chain).
    `usdc_units` is a string like "12.34" in asset units.
    """
    asset_id = _ensure_usdc_dev()

    # Use dispenser as "treasury" for demo
    am = get_account_manager()
    treasury = am.localnet_dispenser()

    # Ensure treasury is opted-in (some SDKs require it too)
    _opt_in_if_needed(treasury.address, treasury.signer.private_key, asset_id)

    min_units = _units_to_min_units(usdc_units)

    # Add envelope to receipt
    note = {
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

    txid = _send_usdc_dev(
        sender_addr=treasury.address,
        sender_sk=treasury.signer.private_key,
        to_addr=to_addr,
        asset_id=asset_id,
        amt_min_units=min_units,
        note_json=note,
    )
    return {
        "txid": txid,
        "asset_id": asset_id,
        "amount_min_units": min_units,
        "decimals": USDC_DECIMALS,
    }


# -----------------------------
# New: Spot testnet buy -> LocalNet mint & send
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

    # ---- 2) Mint & send dev ASA on LocalNet using the filled USDC ----
    envelope = {"binance": binance_meta}
    if extra_receipt:
        envelope.update(extra_receipt)

    onchain = mint_and_send_usdc_dev(
        to_addr=to_addr,
        usdc_units=executed_qty_str,  # already a base-asset amount string
        receipt=envelope,
    )

    # ---- 3) Return a combined result ----
    return {
        "binance_order": binance_meta,
        "onchain": onchain,  # { txid, asset_id, amount_min_units, decimals }
    }
