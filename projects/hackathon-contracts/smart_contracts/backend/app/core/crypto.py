import os
import base64
from cryptography.fernet import Fernet


# Optionally derive key from SESSION_SECRET in dev. In prod provide ALGO_MNEMONIC_ENC_KEY env var.
def _derive_key_from_secret(secret: str) -> bytes:
    raw = (secret or "dev-secret").encode("utf-8")
    # ensure length 32
    raw = (raw + b"0" * 32)[:32]
    return base64.urlsafe_b64encode(raw)


def get_fernet():
    key = os.getenv("ALGO_MNEMONIC_ENC_KEY")
    if key:
        # expect urlsafe base64 key string
        return Fernet(key.encode("utf-8"))
    # fallback to SESSION_SECRET (dev only)
    from app.routers.auth import SESSION_SECRET

    return Fernet(_derive_key_from_secret(SESSION_SECRET))


def encrypt_str(plaintext: str) -> str:
    f = get_fernet()
    return f.encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_str(token: str) -> str:
    f = get_fernet()
    return f.decrypt(token.encode("utf-8")).decode("utf-8")
