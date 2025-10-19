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
        <div className="h-12 overflow-visible">
          <div className="flex items-center h-full">
            <div className="px-2">
              <img
                src="/logo.svg"
                alt="Radcliffe"
                className="h-16 w-auto select-none pointer-events-none -translate-y-[4px]"
                draggable={false}
              />
            </div>
          </div>
        </div>
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
