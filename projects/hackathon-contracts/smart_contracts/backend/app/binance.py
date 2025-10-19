from __future__ import annotations
import os, time, hmac, hashlib, requests
from urllib.parse import urlencode

# ── Env & base normalization ────────────────────────────────────────────────
_RAW_BASE = os.getenv("BINANCE_BASE", "https://testnet.binance.vision").rstrip("/")
if _RAW_BASE.endswith("/api"):  # avoid /api/api/...
    _RAW_BASE = _RAW_BASE[:-4]
BINANCE_BASE = _RAW_BASE

BINANCE_API_KEY = os.getenv("BINANCE_API_KEY", "")
BINANCE_API_SECRET = os.getenv("BINANCE_API_SECRET", "")
BINANCE_DEBUG = os.getenv("BINANCE_DEBUG", "0").lower() in ("1", "true", "yes", "y")
BINANCE_SYMBOL = (
    os.getenv("BINANCE_SYMBOL", "").strip().upper()
)  # optional override, e.g. USDCUSDT

HEADERS_AUTH = (
    {
        "X-MBX-APIKEY": BINANCE_API_KEY,
        "Accept": "application/json",
        "User-Agent": "rad-ramp/1.0",
    }
    if BINANCE_API_KEY
    else {
        "Accept": "application/json",
        "User-Agent": "rad-ramp/1.0",
    }
)
HEADERS_JSON = {"Accept": "application/json", "User-Agent": "rad-ramp/1.0"}


def _dbg(msg: str):
    if BINANCE_DEBUG:
        print(f"[binance] {msg}")


def _json_or_raise(r: requests.Response, label: str):
    txt = r.text or ""
    try:
        data = r.json()
    except Exception:
        raise RuntimeError(f"{label} -> {r.status_code}: {txt[:400]}")
    if r.status_code >= 400:
        raise RuntimeError(f"{label} -> {r.status_code}: {data}")
    if isinstance(data, dict) and "code" in data and data["code"] != 0:
        raise RuntimeError(f"{label} -> 200: {data}")
    return data


# ── Public endpoints ───────────────────────────────────────────────────────
def _public_get(path: str, params: dict | None = None):
    url = f"{BINANCE_BASE}{path}"
    _dbg(f"GET {url} params={params}")
    r = requests.get(url, headers=HEADERS_JSON, params=params or {}, timeout=20)
    _dbg(f"-> {r.status_code} body[:120]={r.text[:120]!r}")
    return _json_or_raise(r, f"GET {path}")


def ping() -> dict:
    return _public_get("/api/v3/ping")


def server_time() -> dict:
    return _public_get("/api/v3/time")


def _symbol_exists(symbol: str) -> bool:
    try:
        _public_get("/api/v3/ticker/price", {"symbol": symbol})
        return True
    except Exception as e:
        _dbg(f"symbol check failed for {symbol}: {e}")
        return False


def pick_stable_pair() -> str:
    # 1) explicit override via env
    if BINANCE_SYMBOL:
        if _symbol_exists(BINANCE_SYMBOL):
            _dbg(f"using symbol (env): {BINANCE_SYMBOL}")
            return BINANCE_SYMBOL
        raise RuntimeError(
            f"BINANCE_SYMBOL={BINANCE_SYMBOL} not available on {BINANCE_BASE}"
        )
    # 2) preferred stables in order
    candidates = ["USDCUSDT", "BUSDUSDT", "FDUSDUSDT", "USDTBUSD", "TUSDUSDT"]
    for s in candidates:
        if _symbol_exists(s):
            _dbg(f"using symbol: {s}")
            return s
    # 3) last resort to prove path (non-stable)
    for s in ["BTCUSDT", "ETHUSDT"]:
        if _symbol_exists(s):
            _dbg(f"using fallback symbol: {s}")
            return s
    raise RuntimeError(f"No suitable pair available on {BINANCE_BASE}")


def ticker_price(symbol: str) -> float:
    data = _public_get("/api/v3/ticker/price", {"symbol": symbol})
    return float(data["price"])


def book_ticker(symbol: str) -> dict:
    data = _public_get("/api/v3/ticker/bookTicker", {"symbol": symbol})
    return {
        "bidPrice": float(data["bidPrice"]),
        "bidQty": float(data["bidQty"]),
        "askPrice": float(data["askPrice"]),
        "askQty": float(data["askQty"]),
    }


def spot_quote_usdc_from_usd(usd_amount: float) -> dict:
    """
    Live spot snapshot for converting USD≈USDT into base (e.g., USDC) using chosen symbol.
    Computes expected base qty at last/mid/ask.
    """
    symbol = find_usdcusdt_symbol()
    last = ticker_price(symbol)
    book = book_ticker(symbol)
    mid = (book["bidPrice"] + book["askPrice"]) / 2.0

    # For pairs like USDCUSDT: price = quote per 1 base; base = USD / price
    expected_usdc_last = usd_amount / last
    expected_usdc_mid = usd_amount / mid
    expected_usdc_ask = usd_amount / book["askPrice"]  # conservative

    return {
        "symbol": symbol,
        "venue": "spot-testnet",
        "price": {
            "last": f"{last:.6f}",
            "bid": f"{book['bidPrice']:.6f}",
            "ask": f"{book['askPrice']:.6f}",
            "mid": f"{mid:.6f}",
            "spread_bps": f"{(book['askPrice'] - book['bidPrice']) / mid * 1e4:.2f}",
        },
        "expected_usdc": {
            "at_last": f"{expected_usdc_last:.6f}",
            "at_mid": f"{expected_usdc_mid:.6f}",
            "at_ask": f"{expected_usdc_ask:.6f}",
        },
    }


# ── Signed endpoints ───────────────────────────────────────────────────────
def _signed_params(params: dict) -> dict:
    q = urlencode({k: str(v) for k, v in params.items()}, doseq=True)
    sig = hmac.new(BINANCE_API_SECRET.encode(), q.encode(), hashlib.sha256).hexdigest()
    return {**{k: str(v) for k, v in params.items()}, "signature": sig}


def _signed_request(method: str, path: str, params: dict):
    if not BINANCE_API_KEY or not BINANCE_API_SECRET:
        raise RuntimeError("Missing BINANCE_API_KEY or BINANCE_API_SECRET")
    url = f"{BINANCE_BASE}{path}"
    sp = _signed_params(params)
    _dbg(f"{method} {url} params={sp}")
    r = requests.request(method, url, headers=HEADERS_AUTH, params=sp, timeout=30)
    _dbg(f"-> {r.status_code} body[:120]={r.text[:120]!r}")
    return _json_or_raise(r, f"{method} {path}")


def account() -> dict:
    return _signed_request(
        "GET",
        "/api/v3/account",
        {
            "timestamp": int(time.time() * 1000),
            "recvWindow": 10000,
        },
    )


def spot_market_buy_usdc_with_usdt(quote_amount: float) -> dict:
    """
    Spend `quote_amount` of quote asset (USDT) to buy base (e.g., USDC).
    Returns Binance order JSON (MARKET order).
    """
    symbol = find_usdcusdt_symbol()
    return _signed_request(
        "POST",
        "/api/v3/order",
        {
            "symbol": symbol,
            "side": "BUY",
            "type": "MARKET",
            "quoteOrderQty": f"{quote_amount}",
            "timestamp": int(time.time() * 1000),
            "recvWindow": 10000,
        },
    )


def find_usdcusdt_symbol() -> str:
    # Back-compat name; actually returns chosen tradable symbol
    return pick_stable_pair()
