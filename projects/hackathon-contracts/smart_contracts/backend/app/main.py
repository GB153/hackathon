from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI()

# allow the Vite dev server to call the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# simple health
@app.get("/health")
def health():
    return {"ok": True}


# demo data for your UI to consume now
FAKE_INVOICES = [
    {"id": "inv_001", "amount": 2500, "currency": "ALGO", "status": "pending"},
    {"id": "inv_002", "amount": 9000, "currency": "ALGO", "status": "paid"},
]


class InvoiceCreate(BaseModel):
    amount: int


@app.post("/invoices")
def create_invoice(payload: InvoiceCreate):
    new = {
        "id": f"inv_{len(FAKE_INVOICES) + 1:03d}",
        "amount": payload.amount,
        "currency": "ALGO",
        "status": "pending",
    }
    FAKE_INVOICES.append(new)
    return new


@app.get("/invoices")
def list_invoices():
    return {"items": FAKE_INVOICES}
