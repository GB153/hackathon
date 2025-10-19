from __future__ import annotations

import hashlib
import logging
import time
from typing import Optional

from algosdk import encoding as algo_encoding, mnemonic, transaction, logic

from app.algorand import (
    get_algorand_client,
    get_account_manager,
    get_or_create_local_account,
)
from app.core.crypto import encrypt_str, decrypt_str
from app.core.firebase import get_firestore_client
from hackathon import (
    ensure_deployed,
    register_user as _register_user,  # write helper
    get_wallet as _get_wallet,  # read helper (reads box directly)
)

log = logging.getLogger("wallet")

USERS = lambda: get_firestore_client().collection("users")
SYSDOC = lambda: get_firestore_client().collection("__sys").document("algorand")


# -----------------------------
# Helpers
# -----------------------------
def _email_norm(email: str) -> str:
    return email.lower().strip()


def _email_sha256(email: str) -> bytes:
    return hashlib.sha256(_email_norm(email).encode("utf-8")).digest()  # 32B


def _addr_to_32(addr: str) -> bytes:
    return algo_encoding.decode_address(addr)  # 32B raw address


def _now() -> float:
    return float(time.time())


# -----------------------------
# Ensure app exists AND funded
# -----------------------------
def _wait_for_confirmation(
    algod, txid: str, timeout_rounds: int = 20, sleep_sec: float = 0.5
) -> None:
    """Minimal wait-for-confirmation without algosdk.future."""
    for _ in range(timeout_rounds):
        try:
            pi = algod.pending_transaction_info(txid)
            if (pi.get("confirmed-round") or 0) > 0:
                return
            if pi.get("pool-error"):
                raise RuntimeError(f"Pool error: {pi['pool-error']}")
        except Exception:
            pass
        time.sleep(sleep_sec)
    raise TimeoutError(f"Transaction {txid} not confirmed after {timeout_rounds} polls")


def _ensure_registry_app_id() -> int:
    """
    Get the single WalletRegistry app_id, creating once if missing,
    then ensure the app account is funded for box writes.
    """
    algo = get_algorand_client()
    algod = algo.client.algod
    am = get_account_manager()
    dispenser = am.localnet_dispenser()

    # 1) Reuse if we already have one recorded
    sysdoc_ref = SYSDOC()
    sysdoc = sysdoc_ref.get().to_dict() or {}
    app_id = sysdoc.get("appId")

    if not app_id:
        # 2) First time: deploy once and persist appId
        app_id = ensure_deployed(
            algod_client=algod,
            deployer_addr=dispenser.address,
            deployer_sk=dispenser.signer.private_key,
        )
        try:
            sysdoc_ref.set({"appId": app_id, "updatedAt": _now()}, merge=True)
        except Exception:
            pass
        log.info("Deployed new WalletRegistry app_id=%s", app_id)
    else:
        log.info("Using existing WalletRegistry app_id=%s", app_id)

    # 3) Ensure the app account is funded (covers MBR + one box)
    from algosdk import logic, transaction

    app_addr = logic.get_application_address(app_id)
    bal = algod.account_info(app_addr).get("amount", 0)
    target = 300_000  # μAlgos: base + ~1 box + headroom

    if bal < target:
        fund_amt = target - bal
        sp = algod.suggested_params()
        sp.flat_fee = True
        sp.fee = max(sp.min_fee, 1_000)
        pay = transaction.PaymentTxn(
            sender=dispenser.address, sp=sp, receiver=app_addr, amt=fund_amt
        )
        stx = pay.sign(dispenser.signer.private_key)
        txid = algod.send_transaction(stx)
        _wait_for_confirmation(algod, txid)
        log.info(
            "Funded app %s (%s) with %s μAlgos (tx %s)",
            app_id,
            app_addr,
            fund_amt,
            txid,
        )
    else:
        log.info("App %s (%s) already funded: %s μAlgos", app_id, app_addr, bal)

    return int(app_id)


# -----------------------------
# On-chain registry helpers
# -----------------------------
def register_user_on_chain(email: str, wallet_addr: str) -> str:
    """
    Registers sha256(email) -> wallet_addr in WalletRegistry boxes.
    Uses the helper in the contracts package (handles fees/boxes). Returns txid.
    """
    algo = get_algorand_client()
    algod = algo.client.algod
    am = get_account_manager()
    admin = am.localnet_dispenser()
    app_id = _ensure_registry_app_id()

    email_hash = _email_sha256(email)
    txid = _register_user(
        algod,  # algod_client
        app_id,  # app_id
        admin.address,  # caller addr
        admin.signer.private_key,  # caller sk
        email_hash,  # 32B email hash
        _addr_to_32(wallet_addr),  # 32B raw addr
    )
    log.info("Registered on-chain %s -> %s (tx %s)", email, wallet_addr, txid)
    return txid


def get_wallet_from_chain(email: str) -> Optional[str]:
    """
    Read-only fetch from WalletRegistry; returns base32 address or None.
    (Uses the contracts helper that reads the box directly — no box ref needed.)
    """
    algo = get_algorand_client()
    algod = algo.client.algod
    app_id = _ensure_registry_app_id()
    email_hash = _email_sha256(email)
    try:
        addr = _get_wallet(algod, app_id, email_hash)
        log.info("On-chain lookup %s -> %s", email, addr)
        return addr or None
    except Exception as e:
        log.warning("On-chain lookup failed for %s: %s", email, e)
        return None


# -----------------------------
# Public API
# -----------------------------
def get_or_create_user_wallet(email: str) -> dict:
    """
    Ensures a LocalNet wallet exists for this user.
    - Creates account via AlgoKit AccountManager (auto-funds on LocalNet).
    - Encrypts mnemonic with Fernet and stores in Firestore.
    - Stores address both plaintext and encrypted.
    - Registers sha256(email)->address in on-chain WalletRegistry.
    """
    email_n = _email_norm(email)
    doc_ref = USERS().document(email_n)
    snap = doc_ref.get()
    data = snap.to_dict() or {}

    # Already provisioned?
    if data.get("walletAddress") and data.get("walletMnemonicEnc"):
        onchain_addr = get_wallet_from_chain(email_n)
        if onchain_addr is None or onchain_addr != data["walletAddress"]:
            try:
                register_user_on_chain(email_n, data["walletAddress"])
                doc_ref.set({"walletRegistered": True, "updatedAt": _now()}, merge=True)
            except Exception as e:
                doc_ref.set(
                    {
                        "walletRegistered": False,
                        "walletRegistryError": str(e),
                        "updatedAt": _now(),
                    },
                    merge=True,
                )
        return {
            "address": data["walletAddress"],
            "walletMnemonicEnc": data["walletMnemonicEnc"],
            "created": False,
            "onChainRegistered": bool(data.get("walletRegistered", False)),
            "walletRegistryAppId": data.get("walletRegistryAppId"),
        }

    # Create/fetch from AlgoKit AccountManager (v3)
    acct = get_or_create_local_account(email_n)  # has .address and .signer
    log.info("Created/fetched local account for %s: %s", email_n, acct.address)

    # Derive mnemonic from private key; encrypt for storage
    mn = mnemonic.from_private_key(acct.signer.private_key)
    enc_mn = encrypt_str(mn)
    enc_addr = encrypt_str(acct.address)  # optional

    now = _now()
    update = {
        **data,
        "walletAddress": acct.address,
        "walletAddressEnc": enc_addr,
        "walletMnemonicEnc": enc_mn,
        "walletCreatedAt": now,
        "updatedAt": now,
    }

    # Register on-chain mapping (best-effort)
    on_chain_ok = False
    try:
        register_user_on_chain(email_n, acct.address)
        on_chain_ok = True
        doc_sys = SYSDOC().get().to_dict() or {}
        if "appId" in doc_sys:
            update["walletRegistryAppId"] = doc_sys["appId"]
        update["walletRegistered"] = True
    except Exception as e:
        log.exception("On-chain register failed for %s: %s", email_n, e)
        update["walletRegistered"] = False
        update["walletRegistryError"] = str(e)

    doc_ref.set(update, merge=True)

    return {
        "address": acct.address,
        "walletMnemonicEnc": enc_mn,
        "created": True,
        "onChainRegistered": on_chain_ok,
        "walletRegistryAppId": update.get("walletRegistryAppId"),
    }


def decrypt_user_mnemonic(email: str) -> str:
    """
    Rarely needed. Prefer signing via AccountManager.
    """
    email_n = _email_norm(email)
    data = USERS().document(email_n).get().to_dict() or {}
    enc = data.get("walletMnemonicEnc")
    if not enc:
        raise RuntimeError("No mnemonic stored")
    return decrypt_str(enc)


def get_user_wallet_record(email: str) -> dict:
    """
    Convenience: returns Firestore & on-chain view to debug.
    """
    email_n = _email_norm(email)
    doc = USERS().document(email_n).get().to_dict() or {}
    onchain_addr = get_wallet_from_chain(email_n)
    return {
        "firestore": {
            "walletAddress": doc.get("walletAddress"),
            "walletAddressEnc": bool(doc.get("walletAddressEnc")),
            "walletMnemonicEnc": bool(doc.get("walletMnemonicEnc")),
            "walletRegistered": doc.get("walletRegistered"),
            "walletRegistryAppId": doc.get("walletRegistryAppId"),
        },
        "onChain": onchain_addr,
        "consistent": onchain_addr == doc.get("walletAddress"),
    }
