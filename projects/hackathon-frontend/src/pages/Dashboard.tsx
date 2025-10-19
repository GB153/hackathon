import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards } from "@/components/section-cards";
import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { DataTable } from "@/components/data-table";
import RButton from "@/components/Button"; // alias to your Radcliffe button
import { useMe } from "@/hooks/user";
import { SidebarTrigger } from "@/components/ui/sidebar"; // shadcn’s trigger

const demoData: any[] = [];

export default function Dashboard() {
  const { user, loading, backend } = useMe();

  // redirect to login if no session
  React.useEffect(() => {
    if (!loading && !user) window.location.href = "/login";
  }, [loading, user]);

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
        <SiteHeader className="sticky top-0 z-10 h-[var(--header-height)] bg-[var(--rad-cream)]/80 backdrop-blur border-b rad-border">
          <div className="flex items-center gap-3 w-full px-4">
            {/* Sidebar trigger */}
            <SidebarTrigger className="shrink-0" />

            {/* Page title */}
            <h1 className="ml-2 text-xl font-display text-[var(--rad-orange)]">Dashboard</h1>

            {/* Right actions */}
            <div className="ml-auto flex items-center gap-4">
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
            </div>
          </div>
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

          {/* Data table */}
          <div className="px-4 lg:px-6">
            <div className="rad-surface border rad-border rounded-2xl p-2">
              <DataTable data={demoData} />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
