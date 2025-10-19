import { useEffect, useState, useCallback } from "react";

export type PaypalStatus = { linked: false } | { linked: true; email: string; merchant_id?: string; role?: string };

export function usePaypal(backend?: string) {
  const [status, setStatus] = useState<PaypalStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!backend) return null;
    try {
      setLoading(true);
      setErr(null);
      const res = await fetch(`${backend}/api/paypal/status`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json: PaypalStatus = await res.json();
      setStatus(json);
      return json;
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load PayPal status");
      setStatus({ linked: false });
      return null;
    } finally {
      setLoading(false);
    }
  }, [backend]);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus]);

  const payout = useCallback(
    async (params: { toEmail: string; amount: string; currency?: string; note?: string }) => {
      if (!backend) throw new Error("Backend URL missing");
      const res = await fetch(`${backend}/api/paypal/payouts`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: params.toEmail,
          amount: params.amount,
          currency: params.currency ?? "GBP",
          note: params.note,
        }),
      });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(t || `status ${res.status}`);
      }
      return res.json();
    },
    [backend],
  );

  const quoteFiat = useCallback(
    async (usd: string) => {
      if (!backend) throw new Error("Backend URL missing");
      const res = await fetch(`${backend}/api/ramp/quote`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usd }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [backend],
  );

  const fiatToUsdc = useCallback(
    async (params: { usd: string; recipientPaypalEmail: string; orderId?: string }) => {
      if (!backend) throw new Error("Backend URL missing");
      const res = await fetch(`${backend}/api/ramp/fiat-to-usdc`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    [backend],
  );

  return {
    status,
    loading,
    err,
    refresh: fetchStatus,
    payout,
    quoteFiat,
    fiatToUsdc,
  };
}
