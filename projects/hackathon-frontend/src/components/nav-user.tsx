import { BellIcon, CreditCardIcon, LogOutIcon, MoreVerticalIcon, UserCircleIcon } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";

export function NavUser({ user }: { user: { name: string; email: string; avatar: string } }) {
  const { isMobile } = useSidebar();
  const initials = (user.name || "CN")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              variant="neutral"
              className={[
                "group/userrow transition-colors",
                // Override any parent hover states
                "!bg-transparent data-[state=open]:!bg-transparent",
                // Apply hover styles ONLY when directly hovering this button
                "hover:!bg-[color:var(--rad-orange,#FA812F)] hover:!text-white",
              ].join(" ")}
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} className="rounded-lg" />
                <AvatarFallback className="rounded-lg bg-[color:var(--rad-orange,#FA812F)] text-white">{initials}</AvatarFallback>
              </Avatar>

              <div className="grid flex-1 text-left leading-tight">
                <span
                  className={[
                    "truncate font-medium",
                    "text-[color:var(--rad-orange,#FA812F)]",
                    // Override any parent group hovers and only respond to this button's hover
                    "group-hover/userrow:!text-white",
                  ].join(" ")}
                  style={{ fontFamily: "General Sans, ui-sans-serif, system-ui" }}
                >
                  {user.name}
                </span>
                <span
                  className={[
                    "truncate text-xs font-light",
                    "text-[color:var(--rad-orange,#FA812F)]",
                    "group-hover/userrow:!text-white",
                  ].join(" ")}
                  style={{ fontFamily: "Alpino, ui-sans-serif, system-ui" }}
                >
                  {user.email}
                </span>
              </div>

              <MoreVerticalIcon
                className={[
                  "ml-auto size-4 rounded-md p-0.5 transition-colors",
                  "text-[color:var(--rad-orange,#FA812F)]",
                  "group-hover/userrow:!text-white group-hover/userrow:!bg-white/10",
                ].join(" ")}
              />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} className="rounded-lg" />
                  <AvatarFallback className="rounded-lg bg-[color:var(--rad-orange,#FA812F)] text-white">{initials}</AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left leading-tight">
                  <span className="truncate font-medium" style={{ fontFamily: "General Sans, ui-sans-serif, system-ui" }}>
                    {user.name}
                  </span>
                  <span className="truncate text-xs font-light" style={{ fontFamily: "Alpino, ui-sans-serif, system-ui" }}>
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <UserCircleIcon />
                Account
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CreditCardIcon />
                Billing
              </DropdownMenuItem>
              <DropdownMenuItem>
                <BellIcon />
                Notifications
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
