from __future__ import annotations
from typing import Optional
import base64

from pyteal import *
from algosdk import encoding as algo_encoding, transaction
from algosdk.atomic_transaction_composer import (
    AtomicTransactionComposer,
    AccountTransactionSigner,
    TransactionWithSigner,
)

# --------------------------------------------------------------------
# PyTeal program: store mapping sha256(email) -> 32-byte raw address
# in application boxes. We use *bare* method dispatch via a string arg.
# --------------------------------------------------------------------


def approval_program() -> Expr:
    # Args for both ops:
    #   arg0: b"register_user" | b"get_wallet"
    #   arg1: email_hash (32 bytes)
    #   arg2: wallet (32 bytes)  -- only for register_user
    method = Txn.application_args[0]
    email_hash = Txn.application_args[1]

    on_create = Approve()

    # register_user(email_hash, wallet)
    is_register = method == Bytes("register_user")
    wallet = Txn.application_args[2]
    do_register = Seq(
        Assert(Len(email_hash) == Int(32)),
        Assert(Len(wallet) == Int(32)),
        App.box_put(email_hash, wallet),  # write 32B raw address
        Approve(),
    )

    # get_wallet(email_hash) – no state change; box read is offchain
    is_get = method == Bytes("get_wallet")
    do_get = Approve()  # no-op (read occurs via indexer/SDK box read)

    return Cond(
        [Txn.application_id() == Int(0), on_create],
        [is_register, do_register],
        [is_get, do_get],
    )


def clear_program() -> Expr:
    return Approve()


# --------------------------------------------------------------------
# Helpers to compile | deploy | call the app via algosdk (no Beaker)
# --------------------------------------------------------------------


def compile_teal(algod, expr: Expr) -> bytes:
    teal = compileTeal(expr, mode=Mode.Application, version=8)
    res = algod.compile(teal)
    return base64.b64decode(res["result"])


def create_app(algod, sender_addr: str, signer_sk: bytes) -> int:
    approval = compile_teal(algod, approval_program())
    clear = compile_teal(algod, clear_program())

    sp = algod.suggested_params()
    txn = transaction.ApplicationCreateTxn(
        sender=sender_addr,
        sp=sp,
        on_complete=transaction.OnComplete.NoOpOC.real,
        approval_program=approval,
        clear_program=clear,
        global_schema=transaction.StateSchema(0, 0),
        local_schema=transaction.StateSchema(0, 0),
    )
    stx = txn.sign(signer_sk)
    txid = algod.send_transaction(stx)
    transaction.wait_for_confirmation(algod, txid, 4)
    info = algod.pending_transaction_info(txid)
    return info["application-index"]


def _box_mbr_fee(key_len: int, val_len: int) -> int:
    # microAlgos required for creating a brand-new box
    return 2500 + 400 * (key_len + val_len)


def call_register_user(
    algod_client,
    app_id: int,
    caller_addr: str,
    caller_sk: bytes,
    email_hash_32: bytes,
    wallet_raw_32: bytes,
) -> str:
    """
    Submit a *bare* app call with args:
      [b"register_user", email_hash_32, wallet_raw_32]
    Include the box reference for `email_hash_32`.
    """
    algod = algod_client
    sp = algod.suggested_params()
    sp.flat_fee = True
    sp.fee = max(sp.min_fee, 1000)

    # Box reference for this email hash must be provided
    boxes = [(app_id, email_hash_32)]

    app_args = [b"register_user", email_hash_32, wallet_raw_32]

    txn = transaction.ApplicationNoOpTxn(
        sender=caller_addr,
        sp=sp,
        index=app_id,
        app_args=app_args,
        boxes=boxes,
    )
    stx = txn.sign(caller_sk)

    atc = AtomicTransactionComposer()
    atc.add_transaction(TransactionWithSigner(txn, AccountTransactionSigner(caller_sk)))
    result = atc.execute(algod, 4)
    return result.tx_ids[0]


def read_wallet_box(algod, app_id: int, email_hash_32: bytes) -> Optional[str]:
    """
    Read the box value and return base32 address if present.
    """
    try:
        box = algod.application_box_by_name(app_id, email_hash_32)
        raw = base64.b64decode(box["value"])  # 32B raw address
        return algo_encoding.encode_address(raw)
    except Exception:
        return None


# --------------------------------------------------------------------
# Public helpers used by your backend
# --------------------------------------------------------------------


def ensure_deployed(algod_client, deployer_addr: str, deployer_sk: bytes) -> int:
    return create_app(algod_client, deployer_addr, deployer_sk)


def register_user(
    algod_client,
    app_id: int,
    admin_addr: str,
    admin_sk: bytes,
    email_hash_32: bytes,
    wallet_raw_32: bytes,
) -> str:
    return call_register_user(
        algod_client, app_id, admin_addr, admin_sk, email_hash_32, wallet_raw_32
    )


def get_wallet(algod_client, app_id: int, email_hash_32: bytes) -> Optional[str]:
    return read_wallet_box(algod_client, app_id, email_hash_32)
