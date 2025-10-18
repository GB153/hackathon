import React from "react";
import Button from "@/components/Button";
import { useMe } from "@/hooks/user";

export default function Dashboard() {
  const { user, loading, backend } = useMe();

  // if unauth when loading finishes → go to /login
  React.useEffect(() => {
    if (!loading && user === null) {
      window.location.replace("/login");
    }
  }, [loading, user]);

  async function handleLogout() {
    try {
      await fetch(`${backend}/auth/logout`, { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  }

  if (loading || user === null) {
    return (
      <div className="min-h-screen theme-radcliffe bg-[var(--background)] text-[var(--foreground)] font-display flex items-center justify-center">
        <div className="text-lg">Loading…</div>
      </div>
    );
  }

  const displayName = user?.name || user?.email || "Friend";

  return (
    <div className="min-h-screen theme-radcliffe bg-[var(--background)] text-[var(--foreground)] font-display">
      {/* Header */}
      <header className="flex items-center justify-between px-4 lg:px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-3">
          <img src="/logo.svg" className="h-8 w-auto" alt="Radcliffe" />
          <div className="text-xl">Welcome, {displayName}</div>
        </div>
        <div className="flex items-center gap-3">
          {user?.picture && <img src={user.picture} className="h-8 w-8 rounded-full object-cover" alt="avatar" />}
          <Button label="Logout" onClick={handleLogout} />
        </div>
      </header>

      {/* Main */}
      <main className="px-4 lg:px-6 py-6 space-y-6">
        {/* Cards */}
        <section className="grid gap-4 md:grid-cols-3">
          <Card title="Status" value="All systems nominal" />
          <Card title="Projects" value="3 active" />
          <Card title="Notifications" value="0 unread" />
        </section>

        {/* Chart placeholder */}
        <section className="rounded-2xl border bg-[var(--card)] p-6" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 text-lg">Overview</div>
          <div className="h-48 rounded-xl border border-dashed flex items-center justify-center" style={{ borderColor: "var(--border)" }}>
            <span className="text-[var(--muted-foreground)]">Chart goes here</span>
          </div>
        </section>

        {/* Table placeholder */}
        <section className="rounded-2xl border bg-[var(--card)] p-4" style={{ borderColor: "var(--border)" }}>
          <div className="mb-3 text-lg">Recent activity</div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full border-separate border-spacing-y-2">
              <thead>
                <tr className="text-left text-sm text-[var(--muted-foreground)]">
                  <th className="px-3 py-2">Item</th>
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { item: "Alpha", date: "Today", status: "OK" },
                  { item: "Beta", date: "Yesterday", status: "OK" },
                ].map((r, i) => (
                  <tr key={i} className="bg-[var(--background)] rounded-xl">
                    <td className="px-3 py-2 rounded-l-xl">{r.item}</td>
                    <td className="px-3 py-2">{r.date}</td>
                    <td className="px-3 py-2">{r.status}</td>
                    <td className="px-3 py-2 rounded-r-xl text-right">
                      <Button label="Open" onClick={() => alert(`Open ${r.item}`)} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4 bg-[var(--card)]" style={{ borderColor: "var(--border)" }}>
      <div className="text-sm text-[var(--muted-foreground)] mb-1">{title}</div>
      <div className="text-2xl">{value}</div>
    </div>
  );
}
