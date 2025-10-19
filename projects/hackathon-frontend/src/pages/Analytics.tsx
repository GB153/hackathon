"use client";
import React from "react";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import RButton from "@/components/Button";
import { useMe } from "@/hooks/user";
import { useAnalytics } from "@/hooks/useAnalytics";
import { TxTable } from "@/components/TxTable";

export default function Analytics() {
  const { user, loading, backend } = useMe();
  const { rows, loading: fetching, err } = useAnalytics();

  React.useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [loading, user]);

  if (loading || !user) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--rad-cream)] text-[var(--rad-orange)]">
        <div className="animate-pulse font-display">Loading analytics…</div>
      </div>
    );
  }

  const displayName = user.name || user.email;

  return (
    <SidebarProvider defaultOpen style={{ "--sidebar-width": "288px", "--header-height": "72px" } as React.CSSProperties}>
      <AppSidebar className="bg-[var(--rad-cream)] text-[var(--rad-orange)] border-r rad-border" />
      <SidebarInset className="bg-[var(--rad-cream)] min-h-screen">
        <SiteHeader
          title="Analytics"
          className="sticky top-0 z-10 h-[var(--header-height)] bg-[var(--rad-cream)]/80 backdrop-blur border-b rad-border"
        >
          <span className="hidden sm:inline text-[var(--rad-ink)]/80">
            Hi, <strong className="text-[var(--rad-orange)]">{displayName}</strong>
          </span>
          <RButton
            label="Logout"
            className="!bg-[var(--rad-orange)] !text-white rounded-xl px-4 py-2"
            onClick={async () => {
              try {
                await fetch(`${backend}/users/logout`, { method: "POST", credentials: "include" });
              } finally {
                window.location.href = "/login";
              }
            }}
          />
        </SiteHeader>

        <div className="flex-1 flex flex-col gap-6 py-6">
          <div className="px-4 lg:px-6">
            <div className="rad-surface border rad-border rounded-2xl p-2">
              {err ? <div className="p-4 text-red-600 text-sm">{err}</div> : <TxTable data={rows} loading={fetching} />}
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
