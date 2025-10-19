import { useEffect, useState } from "react";
import { useMe } from "./user";

export type TxRow = {
  ts: string;
  txid: string;
  direction: "IN" | "OUT";
  status: "Received" | "Sent";
  amountSigned: string;
  amountRaw: string;
  from: string;
  to: string;
  noteType?: string;
};

export function useAnalytics() {
  const { backend, user } = useMe();
  const [rows, setRows] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!backend || !user) return;
      try {
        setLoading(true);
        setErr(null);
        const r = await fetch(`${backend}/api/tx/history`, { credentials: "include" });
        if (!r.ok) throw new Error(await r.text());
        const j = await r.json();

        const mapped: TxRow[] = (j?.items ?? []).map((t: any) => {
          const unit = t.asset?.unit ?? t.asset?.name ?? "";
          const rawAmt = `${t.amount ?? "0.00"} ${unit}`.trim();
          const dir: "IN" | "OUT" = t.direction === "OUT" ? "OUT" : "IN";
          const status: TxRow["status"] = dir === "OUT" ? "Sent" : "Received";
          const amountSigned = `${dir === "OUT" ? "-" : "+"}${rawAmt}`;
          const tsSec = typeof t.ts === "number" ? t.ts : (t.timestamp ?? Math.round(Date.now() / 1000));
          return {
            ts: new Date(tsSec * 1000).toLocaleString(),
            txid: t.txid,
            direction: dir,
            status,
            amountSigned,
            amountRaw: rawAmt,
            from: t.from,
            to: t.to,
            noteType: t.note?.type,
          };
        });

        if (alive) setRows(mapped);
      } catch (e: any) {
        if (alive) setErr(e?.message ?? "Failed to load analytics");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [backend, user?.email]); // refetch when user changes

  return { rows, loading, err };
}
