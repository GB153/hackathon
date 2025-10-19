"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Button from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

type Balance = {
  address: string;
  algo: { total: number; spendable: number; minBalance: number };
  asas: { id: number; name?: string; unit?: string; balance: number; decimals: number }[];
};

export default function TransferDialog({ open, onOpenChange }: Props) {
  const [loading, setLoading] = React.useState(false);
  const [connecting, setConnecting] = React.useState(false);
  const [balance, setBalance] = React.useState<Balance | null>(null);
  const [assetType, setAssetType] = React.useState<"ALGO" | "ASA">("ALGO");
  const [selectedAsa, setSelectedAsa] = React.useState<string>("");
  const [to, setTo] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function fetchBalances() {
    setError(null);
    try {
      const res = await fetch(`/api/wallet/balance`);
      if (!res.ok) throw new Error(await res.text());
      const data: Balance = await res.json();
      setBalance(data);
      if (data.asas.length && !selectedAsa) setSelectedAsa(String(data.asas[0].id));
    } catch (e: any) {
      setError(e?.message ?? "Failed to load balance");
    }
  }

  React.useEffect(() => {
    if (!open) return;
    setConnecting(true);
    fetchBalances().finally(() => setConnecting(false));
    setAssetType("ALGO");
    setSelectedAsa("");
    setTo("");
    setAmount("");
    setError(null);
  }, [open]);

  function fillMax() {
    if (!balance) return;
    if (assetType === "ALGO") setAmount(String(balance.algo.spendable));
    else if (assetType === "ASA" && selectedAsa) {
      const a = balance.asas.find((x) => String(x.id) === selectedAsa);
      if (a) setAmount(String(a.balance));
    }
  }

  async function submit() {
    setLoading(true);
    setError(null);
    try {
      const body =
        assetType === "ALGO"
          ? { to, amount: Number(amount), assetType: "ALGO" }
          : { to, amount: Number(amount), assetType: "ASA", assetId: Number(selectedAsa) };

      const res = await fetch(`/api/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      onOpenChange(false);
    } catch (e: any) {
      setError(e?.message ?? "Transfer failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg rounded-3xl font-display bg-[#FFEDC5] text-[#FA812F] border border-[#FA812F]/30">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold font-display text-[#FA812F]">Transfer</DialogTitle>
          <DialogDescription className="text-base font-display text-[#FA812F]/85">
            Send ALGO or ASA securely using your connected Radcliffe wallet.
          </DialogDescription>
        </DialogHeader>

        {/* Wallet + balances */}
        <div className="rounded-2xl border border-[#FA812F]/40 p-4 bg-white/10 backdrop-blur-sm">
          {connecting ? (
            <div className="text-sm text-[#FA812F]/90 font-display">Loading balances…</div>
          ) : balance ? (
            <div className="space-y-2 text-[#FA812F] font-display">
              <div className="text-xs opacity-70">Address</div>
              <div className="font-mono text-xs break-all">{balance.address}</div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="opacity-70">ALGO total</div>
                  <div className="font-medium">{balance.algo.total}</div>
                </div>
                <div>
                  <div className="opacity-70">Spendable</div>
                  <div className="font-medium">{balance.algo.spendable}</div>
                </div>
                <div>
                  <div className="opacity-70">Min balance</div>
                  <div className="font-medium">{balance.algo.minBalance}</div>
                </div>
              </div>

              {balance.asas.length > 0 && (
                <div className="mt-2">
                  <div className="opacity-70 text-sm mb-1">ASAs</div>
                  <div className="max-h-28 overflow-auto text-sm space-y-1">
                    {balance.asas.map((a) => (
                      <div key={a.id} className="flex justify-between">
                        <span>{a.name ?? a.unit ?? `ASA ${a.id}`}</span>
                        <span className="font-medium">{a.balance}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-red-600 font-display">No balance data.</div>
          )}
        </div>

        {/* Asset pickers */}
        <div className="grid grid-cols-2 gap-3 mt-4 text-[#FA812F] font-display">
          <div className="space-y-1.5">
            <Label className="text-[#FA812F] font-display">Asset</Label>
            <Select value={assetType} onValueChange={(v: any) => setAssetType(v)}>
              <SelectTrigger className="rounded-2xl border-[#FA812F]/60 text-[#FA812F]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALGO">ALGO</SelectItem>
                <SelectItem value="ASA" disabled={!balance || balance.asas.length === 0}>
                  ASA
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[#FA812F] font-display">Token</Label>
            <Select
              value={selectedAsa}
              onValueChange={setSelectedAsa}
              disabled={assetType !== "ASA" || !balance || balance.asas.length === 0}
            >
              <SelectTrigger className="rounded-2xl border-[#FA812F]/60 text-[#FA812F]">
                <SelectValue placeholder="—" />
              </SelectTrigger>
              <SelectContent>
                {(balance?.asas ?? []).map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.name ?? a.unit ?? `ASA ${a.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Recipient + amount */}
        <div className="space-y-1.5 mt-4 text-[#FA812F] font-display">
          <Label className="text-[#FA812F] font-display">Recipient address</Label>
          <Input
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="ALGOs… address"
            className="rounded-2xl bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none"
          />
        </div>

        {/* Amount + Max */}
        <div className="flex items-end gap-2 mt-4">
          <div className="flex-1 space-y-1.5 text-[#FA812F] font-display">
            <Label className="text-[#FA812F] font-display">Amount</Label>
            <Input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="rounded-2xl bg-transparent text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none"
            />
          </div>
          <Button label="Max" onClick={fillMax} className="!px-4 !py-2" />
        </div>

        {error && <div className="text-red-500 text-sm mt-2 font-display">{error}</div>}

        {/* Footer buttons */}
        <div className="flex justify-end gap-3 mt-6">
          {/* Cancel: red theme, no orange */}
          <button
            onClick={() => onOpenChange(false)}
            className="
              relative inline-flex select-none items-center justify-center
              rounded-2xl px-8 py-3 gap-3 font-display font-normal
              bg-transparent text-red-500 border-[1px] border-red-500
              shadow-[0_6px_0_0_rgba(220,38,38,0.4)]
              transition-all duration-200 ease-out
              hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(220,38,38,0.4)]
              active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(220,38,38,0.4)]
              focus:outline-none
              touch-manipulation
            "
          >
            Cancel
          </button>

          {/* Submit: orange default */}
          <Button label={loading ? "Sending…" : "Send"} onClick={submit} disabled={loading || !amount || !to} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
