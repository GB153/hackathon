from fastapi import APIRouter, Depends, HTTPException
from app.algorand import get_algorand_client
from app.algorand_usdc import _ensure_usdc_dev
from app.routers.auth import get_current_user
import base64, json

router = APIRouter(prefix="/api/tx", tags=["tx"])


@router.get("/history")
def tx_history(user=Depends(get_current_user)):
    if not user:
        raise HTTPException(401, "not authenticated")

    algo = get_algorand_client()
    indexer = algo.client.indexer
    asset_id = _ensure_usdc_dev()

    # resolve user's wallet (same helper you use elsewhere)
    from app.algorand import get_or_create_local_account

    acct = get_or_create_local_account(user["email"])
    addr = acct.address

    res = indexer.search_transactions(address=addr, asset_id=asset_id, limit=50)

    items = []
    for tx in res.get("transactions", []):
        asa = tx.get("asset-transfer-transaction")
        if not asa:  # only ASA transfers
            continue
        amount = asa.get("amount", 0)
        sender = tx.get("sender")
        receiver = asa.get("receiver")
        direction = "OUT" if sender == addr else "IN"
        note_raw = tx.get("note")
        note = None
        if note_raw:
            try:
                note = json.loads(base64.b64decode(note_raw).decode("utf-8"))
            except Exception:
                note = None

        items.append(
            {
                "txid": tx.get("id"),
                "ts": tx.get("round-time"),
                "direction": direction,
                "amount": f"{amount / 1_000_000:.2f}",  # USDC-DEV has 6dp
                "asset": {
                    "id": asa.get("asset-id"),
                    "unit": "USDCd",
                    "name": "USDC-DEV",
                },
                "from": sender,
                "to": receiver,
                "note": note,
            }
        )

    return {"items": items}
