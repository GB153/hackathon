import * as React from "react";
import { BarChartIcon, FolderIcon, HelpCircleIcon, LayoutDashboardIcon, ListIcon, SettingsIcon, UsersIcon } from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavSecondary } from "@/components/nav-secondary";
import { NavUser } from "@/components/nav-user";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader } from "@/components/ui/sidebar";
import { useMe } from "@/hooks/user";

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useMe();

  const data = {
    user: {
      name: user?.name || "User",
      email: user?.email || "",
      avatar: user?.picture || "/avatars/placeholder.png",
    },
    navMain: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboardIcon },
      { title: "Lifecycle", url: "/lifecycle", icon: ListIcon },
      { title: "Analytics", url: "/analytics", icon: BarChartIcon },
      { title: "Projects", url: "/projects", icon: FolderIcon },
      { title: "Team", url: "/team", icon: UsersIcon },
    ],
    navSecondary: [
      { title: "Settings", url: "/settings", icon: SettingsIcon },
      { title: "Get Help", url: "/help", icon: HelpCircleIcon },
    ],
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      {/* Logo header */}
      <SidebarHeader className="p-2 pb-0">
        <div className="flex items-center pl-2">
          <img src="/logo.svg" alt="Radcliffe" className="h-24 w-auto select-none pointer-events-none" draggable={false} />
        </div>
        <div className="mt-1" />
      </SidebarHeader>

      {/* Navigation */}
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary items={data.navSecondary} className="mt-auto" />
      </SidebarContent>

      {/* Footer: user profile row */}
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
