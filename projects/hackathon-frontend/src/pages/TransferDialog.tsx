"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Button from "@/components/Button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMe } from "@/hooks/user";
import { usePaypal } from "@/hooks/usePaypal";

type Props = { open: boolean; onOpenChange: (v: boolean) => void };

const AMOUNT_RE = /^\d+(\.\d{1,2})?$/;
type StepKey = "quote" | "payout" | "mint";
type StepState = "idle" | "active" | "done" | "error";

export default function TransferDialog({ open, onOpenChange }: Props) {
  const { backend } = useMe();
  const { status, loading: ppLoading, err: ppErr, payout, refresh, quoteFiat, fiatToUsdc } = usePaypal(backend);

  // Payout form state
  const [toEmail, setToEmail] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");

  // Link form (if not linked)
  const [linkEmail, setLinkEmail] = React.useState("");
  const [linking, setLinking] = React.useState(false);
  const [linkMsg, setLinkMsg] = React.useState<string | null>(null);

  // Flow state
  const [sending, setSending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [progress, setProgress] = React.useState(0);
  const [steps, setSteps] = React.useState<Record<StepKey, StepState>>({
    quote: "idle",
    payout: "idle",
    mint: "idle",
  });

  // Centered inner width for consistent layout
  const shell = "mx-auto w-[80%]";

  // reset on open
  React.useEffect(() => {
    if (!open) return;
    setError(null);
    setToEmail("");
    setAmount("");
    setNote("");
    setLinkEmail("");
    setLinkMsg(null);
    setSteps({ quote: "idle", payout: "idle", mint: "idle" });
    setProgress(0);
    void refresh(); // check link each time dialog opens
  }, [open]); // (refresh is stable in the updated hook)

  async function connectPaypal() {
    if (!backend) return setLinkMsg("Backend URL missing");
    try {
      setLinking(true);
      setLinkMsg(null);
      const r = await fetch(`${backend}/api/paypal/connect`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paypal_email: linkEmail.trim() }),
      });
      if (!r.ok) {
        const t = await r.text().catch(() => "");
        throw new Error(t || `status ${r.status}`);
      }
      setLinkMsg("Connected. Loading…");
      await refresh();
      setTimeout(() => setLinkMsg(null), 800);
    } catch (e: any) {
      setLinkMsg(e?.message ?? "Failed to link account");
    } finally {
      setLinking(false);
    }
  }

  // Ensure link state *right now* (avoid stale hook state)
  async function ensureLinkedLive(): Promise<boolean> {
    if (!backend) return false;
    try {
      const r = await fetch(`${backend}/api/paypal/status`, { credentials: "include" });
      if (!r.ok) return false;
      const j = await r.json();
      return !!j?.linked;
    } catch {
      return false;
    }
  }

  // 🎉 Imperative confetti launcher (no extra UI needed)
  async function celebrate() {
    const confetti = (await import("canvas-confetti")).default;
    // two bursts from center
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.35 } });
    setTimeout(() => {
      confetti({ particleCount: 120, spread: 120, origin: { y: 0.35 } });
    }, 180);
  }

  async function runFlow() {
    try {
      setSending(true);
      setError(null);
      setSteps({ quote: "active", payout: "idle", mint: "idle" });
      setProgress(10);

      // Always re-validate linkage right before executing
      const isLinked = await ensureLinkedLive();
      if (!isLinked) throw new Error("Please connect your account first.");

      if (!AMOUNT_RE.test(amount.trim())) throw new Error("Enter a valid USD amount (e.g., 10 or 10.50).");
      if (!toEmail.trim()) throw new Error("Recipient email required.");

      // 1) Quote (UI + for receipt)
      await quoteFiat(amount.trim());
      setSteps((s) => ({ ...s, quote: "done" }));
      setProgress(40);

      // 2) PayPal payout
      setSteps((s) => ({ ...s, payout: "active" }));
      const pay = await payout({
        toEmail: toEmail.trim(),
        amount: amount.trim(),
        currency: "USD",
        note: note.trim() || undefined,
      });
      setSteps((s) => ({ ...s, payout: "done" }));
      setProgress(70);

      const orderId = pay?.batch_header?.payout_batch_id || pay?.payout_batch_id || pay?.batchHeader?.payout_batch_id;

      // 3) Mint & deposit to wallet + on-chain receipt
      setSteps((s) => ({ ...s, mint: "active" }));
      await fiatToUsdc({
        usd: amount.trim(),
        recipientPaypalEmail: toEmail.trim(),
        orderId,
      });
      setSteps((s) => ({ ...s, mint: "done" }));
      setProgress(100);

      await celebrate(); // fire confetti on success
      setTimeout(() => onOpenChange(false), 900);
    } catch (e: any) {
      setError(e?.message ?? "Transfer failed");
      setSteps((s) => {
        const next = { ...s };
        (["mint", "payout", "quote"] as StepKey[]).forEach((k) => {
          if (next[k] === "active") next[k] = "error";
        });
        return next;
      });
    } finally {
      setSending(false);
    }
  }

  const linked = status?.linked === true;
  const fromEmail = linked && "email" in (status || {}) ? (status as any)?.email : "";

  function StepChip({ label, state }: { label: string; state: StepState }) {
    const base = "text-xs px-2 py-1 rounded-full border";
    const map: Record<StepState, string> = {
      idle: "border-[#FA812F]/30 text-[#FA812F]/70 bg-white",
      active: "border-[#FA812F] text-white bg-[#FA812F]",
      done: "border-emerald-500 text-emerald-700 bg-emerald-50",
      error: "border-red-500 text-red-600 bg-red-50",
    };
    return <span className={`${base} ${map[state]}`}>{label}</span>;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl font-display bg-[#FFEDC5] text-[#FA812F] border border-[#FA812F]/30">
        <DialogHeader className={shell}>
          <DialogTitle className="text-2xl font-bold text-[#FA812F]">Transfer</DialogTitle>
          <DialogDescription className="text-sm leading-relaxed" style={{ color: "#F39F54" }}>
            Send funds using your connected account. If your account isn’t connected yet, link it below.
          </DialogDescription>
        </DialogHeader>

        {/* Fixed-length, centered progress bar */}
        {(sending || steps.quote !== "idle" || steps.payout !== "idle" || steps.mint !== "idle") && (
          <div className={`${shell} h-1 rounded-full bg-white/50 overflow-hidden mb-3`}>
            <div className="h-1 bg-[#FA812F] transition-all" style={{ width: `${progress}%` }} aria-hidden />
          </div>
        )}
        {(steps.quote !== "idle" || steps.payout !== "idle" || steps.mint !== "idle") && (
          <div className={`${shell} flex gap-2 flex-wrap mb-3 justify-center`}>
            <StepChip label="Quote" state={steps.quote} />
            <StepChip label="Pay" state={steps.payout} />
            <StepChip label="Deposit" state={steps.mint} />
          </div>
        )}

        {/* Checking/linked states */}
        {ppLoading ? (
          <div className={`${shell} text-sm text-[#FA812F]/90`}>Checking account…</div>
        ) : linked ? (
          <div className={`${shell} space-y-4`}>
            {/* FROM (read-only) */}
            <div className="space-y-1.5">
              <Label className="text-[#FA812F]">From</Label>
              <Input
                value={fromEmail || ""}
                readOnly
                className="rounded-2xl bg-white text-[#FA812F] border border-[#FA812F]/60 pointer-events-none"
              />
              <div className="text-xs" style={{ color: "#F39F54" }}>
                Your linked account.
              </div>
            </div>

            {/* TO */}
            <div className="space-y-1.5">
              <Label className="text-[#FA812F]">To</Label>
              <Input
                type="email"
                placeholder="personal-sbx@example.com"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0"
              />
            </div>

            {/* Amount */}
            <div className="space-y-1.5">
              <Label className="text-[#FA812F]">Amount (USD)</Label>
              <Input
                inputMode="decimal"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0"
              />
            </div>

            {/* Note (optional) */}
            <div className="space-y-1.5">
              <Label className="text-[#FA812F]">Note (optional)</Label>
              <Input
                placeholder="Powering the world.."
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0"
              />
            </div>

            {/* Errors only (no raw JSON / success text) */}
            {ppErr && <div className="text-sm text-red-600">{ppErr}</div>}
            {error && <div className="text-sm text-red-600">{error}</div>}

            {/* Footer */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => onOpenChange(false)}
                className="
                  relative inline-flex items-center justify-center
                  rounded-2xl px-6 py-3 font-display
                  bg-transparent text-red-500 border border-red-500
                  shadow-[0_6px_0_0_rgba(220,38,38,0.4)] transition-all
                  hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(220,38,38,0.4)]
                  active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(220,38,38,0.4)]
                "
              >
                Cancel
              </button>
              <Button
                label={sending ? "Sending…" : "Send"}
                onClick={runFlow}
                disabled={sending || !toEmail.trim() || !AMOUNT_RE.test(amount.trim())}
              />
            </div>
          </div>
        ) : (
          // Not linked → inline connect form
          <div className={`${shell} space-y-4`}>
            <div className="space-y-1.5">
              <Label className="text-[#FA812F]">Your account email</Label>
              <Input
                type="email"
                placeholder="you@example.com"
                value={linkEmail}
                onChange={(e) => setLinkEmail(e.target.value)}
                className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0"
              />
              <div className="text-xs" style={{ color: "#F39F54" }}>
                We’ll link this account for transfers.
              </div>
            </div>

            {ppErr && <div className="text-sm text-red-600">{ppErr}</div>}
            {linkMsg && <div className="text-sm text-[#FA812F]">{linkMsg}</div>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => onOpenChange(false)}
                className="
                  relative inline-flex items-center justify-center
                  rounded-2xl px-6 py-3 font-display
                  bg-transparent text-red-500 border border-red-500
                  shadow-[0_6px_0_0_rgba(220,38,38,0.4)] transition-all
                  hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(220,38,38,0.4)]
                  active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(220,38,38,0.4)]
                "
              >
                Cancel
              </button>
              <Button label={linking ? "Connecting…" : "Connect"} onClick={connectPaypal} disabled={linking || !linkEmail.trim()} />
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
