"use client";
import * as React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import Button from "@/components/Button";
import { Input } from "@/components/ui/input";
import { usePaypal } from "@/hooks/usePaypal";

type Props = {
  backend: string; // e.g. from useMe().backend
  open: boolean;
  onOpenChange: (v: boolean) => void;
};

export default function PayPalPayoutDialog({ backend, open, onOpenChange }: Props) {
  const { status, loading, err, createPayout, refresh } = usePaypal(backend);

  const [toEmail, setToEmail] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [note, setNote] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  // Reset when the dialog (re)opens
  React.useEffect(() => {
    if (!open) return;
    setToEmail("");
    setAmount("");
    setNote("");
    setMessage(null);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const canSubmit =
    !loading && status?.linked === true && !!status.email && !!toEmail.trim() && !!amount.trim() && /^[0-9]+(\.[0-9]{1,2})?$/.test(amount);

  async function onSubmit() {
    try {
      setSubmitting(true);
      setMessage(null);
      const res = await createPayout(toEmail.trim(), amount.trim(), "USD", note.trim() || undefined);
      const batchId = res?.batch_header?.payout_batch_id || res?.batch_header?.payout_batch_id;
      setMessage(batchId ? `Payout submitted. Batch ID: ${batchId}` : "Payout submitted.");
      // Auto-close after a moment
      setTimeout(() => onOpenChange(false), 900);
    } catch (e: any) {
      setMessage(e?.message ?? "Failed to create payout");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-3xl font-display bg-[#FFEDC5] text-[#FA812F] border border-[#FA812F]/30">
        <DialogHeader className="space-y-1.5">
          <DialogTitle className="text-2xl font-semibold">Send with PayPal</DialogTitle>
          <DialogDescription className="text-[15px]" style={{ color: "#F39F54" }}>
            Transfer funds from your linked PayPal account to another PayPal email.
          </DialogDescription>
        </DialogHeader>

        {/* From account */}
        <div className="space-y-2 mt-2">
          <div className="text-sm font-medium text-[#FA812F]">From</div>
          <div className="rounded-2xl border border-[#FA812F]/40 bg-white px-3 py-2 text-sm text-[#FA812F]">
            {loading ? "Checking link…" : status.linked ? status.email : "Not linked"}
          </div>
          {!loading && !status.linked && (
            <div className="text-sm" style={{ color: "#F39F54" }}>
              You haven’t linked a PayPal account yet. Go to Dashboard → “Connect PayPal” to link one.
            </div>
          )}
        </div>

        {/* To + Amount + Note */}
        <div className="space-y-4 mt-4">
          <div className="space-y-1.5">
            <label className="text-sm text-[#FA812F]">To (PayPal email)</label>
            <Input
              type="email"
              placeholder="recipient@example.com"
              value={toEmail}
              onChange={(e) => setToEmail(e.target.value)}
              className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-[#FA812F]">Amount (USD)</label>
            <Input
              inputMode="decimal"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none"
            />
            <div className="text-xs" style={{ color: "#F39F54" }}>
              Format: 12 or 12.34 (max two decimals).
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-[#FA812F]">Note (optional)</label>
            <Input
              placeholder="Thanks for testing"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="rounded-2xl bg-white text-[#FA812F] placeholder-[#FA812F]/60 border border-[#FA812F]/60 focus:border-[#FA812F] focus:ring-0 outline-none"
            />
          </div>
        </div>

        {/* Status / error */}
        {err && <div className="text-sm mt-2 text-red-600">{err}</div>}
        {message && (
          <div className="text-sm mt-2" style={{ color: "#F39F54" }}>
            {message}
          </div>
        )}

        {/* Footer */}
        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={() => onOpenChange(false)}
            className="
              relative inline-flex items-center justify-center rounded-2xl px-6 py-3
              font-display bg-transparent text-red-500 border border-red-500
              shadow-[0_6px_0_0_rgba(220,38,38,0.4)] transition-all
              hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(220,38,38,0.4)]
              active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(220,38,38,0.4)]
            "
          >
            Cancel
          </button>
          <Button label={submitting ? "Sending…" : "Send"} onClick={onSubmit} disabled={submitting || !canSubmit} />
        </div>
      </DialogContent>
    </Dialog>
  );
}
