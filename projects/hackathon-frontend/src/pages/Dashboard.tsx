// src/pages/Dashboard.tsx
"use client";

import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import RButton from "@/components/Button";
import { useMe } from "@/hooks/user";
import TransferDialog from "./TransferDialog";

type PaypalStatus = { linked: false } | { linked: true; email: string; merchant_id?: string };

export default function Dashboard() {
  const { user, loading, backend } = useMe();

  const [ppOpen, setPpOpen] = React.useState(false);
  const [checkedPayPal, setCheckedPayPal] = React.useState(false);
  const [isLinked, setIsLinked] = React.useState<boolean | null>(null);

  // Redirect if not logged in
  React.useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [loading, user]);

  // On mount, check PayPal status and auto-open dialog if not linked
  React.useEffect(() => {
    if (!backend || !user || checkedPayPal) return;
    (async () => {
      try {
        const r = await fetch(`${backend}/api/paypal/status`, { credentials: "include" });
        if (!r.ok) throw new Error(String(r.status));
        const j: PaypalStatus = await r.json();
        const linked = j.linked === true;
        setIsLinked(linked);
        if (!linked) setPpOpen(true);
      } catch {
        setIsLinked(null);
      } finally {
        setCheckedPayPal(true);
      }
    })();
  }, [backend, user, checkedPayPal]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--rad-cream)] text-[var(--rad-orange)]">
        <div className="animate-pulse font-display">Loading your dashboard…</div>
      </div>
    );
  }

  const displayName = user.name || user.email;

  return (
    <SidebarProvider
      defaultOpen
      style={
        {
          "--sidebar-width": "288px",
          "--header-height": "72px",
        } as React.CSSProperties
      }
    >
      {/* Sidebar */}
      <AppSidebar className="bg-[var(--rad-cream)] text-[var(--rad-orange)] border-r rad-border" />

      {/* Main content */}
      <SidebarInset className="bg-[var(--rad-cream)] min-h-screen">
        {/* Sticky site header */}
        <SiteHeader
          title="Dashboard"
          className="sticky top-0 z-10 h-[var(--header-height)] bg-[var(--rad-cream)]/80 backdrop-blur border-b rad-border"
        >
          {!isLinked && backend && (
            <button
              className="px-3 py-2 rounded-xl border rad-border bg-white hover:bg-[var(--rad-cream)] transition text-[var(--rad-orange)]"
              onClick={() => setPpOpen(true)}
            >
              Connect PayPal
            </button>
          )}
          <span className="hidden sm:inline text-[var(--rad-ink)]/80">
            Hi, <strong className="text-[var(--rad-orange)]">{displayName}</strong>
          </span>
          <RButton
            label="Logout"
            className="!bg-[var(--rad-orange)] !text-white rounded-xl px-4 py-2"
            onClick={async () => {
              try {
                await fetch(`${backend}/users/logout`, {
                  method: "POST",
                  credentials: "include",
                });
              } finally {
                window.location.href = "/login";
              }
            }}
          />
        </SiteHeader>

        {/* Content sections */}
        <div className="flex-1 flex flex-col gap-6 py-6">
          {/* Cards row */}
          <div className="px-4 lg:px-6">
            <SectionCards className="[&_.card]:bg-white [&_.card]:border rad-border" />
          </div>

          {/* Interactive chart */}
          <div className="px-4 lg:px-6">
            <div className="rad-surface border rad-border rounded-2xl p-4">
              <ChartAreaInteractive />
            </div>
          </div>
        </div>

        {/* PayPal connect / transfer dialog */}
        <TransferDialog open={ppOpen} onOpenChange={setPpOpen} />
      </SidebarInset>
    </SidebarProvider>
  );
}
