"use client";

import * as React from "react";
import { NavLink, useLocation } from "react-router-dom";
import { MailIcon, PlusCircleIcon, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import TransferDialog from "@/pages/TransferDialog";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const SQUIGGLES = {
  a: "M0 3 C 10 6, 25 0, 40 3 S 70 6, 100 3",
  b: "M0 3 C 8 0, 22 6, 35 3 S 65 0, 100 3",
  c: "M0 3 C 12 5.5, 28 0.5, 50 3 S 82 5.5, 100 3",
} as const;
type Variant = keyof typeof SQUIGGLES;

export function NavMain({ items }: { items: { title: string; url: string; icon?: LucideIcon }[] }) {
  const { pathname } = useLocation();
  const [transferOpen, setTransferOpen] = React.useState(false);

  return (
    <SidebarGroup>
      <style>{`
        @keyframes dashSolid {
          0%   { stroke-dashoffset: 110; opacity: .15 }
          10%  { opacity: 1 }
          100% { stroke-dashoffset: 0; opacity: 1 }
        }
        @keyframes dashDotted {
          0%   { stroke-dashoffset: 110; opacity: 0 }
          12%  { opacity: .5 }
          100% { stroke-dashoffset: 0; opacity: .5 }
        }
        .animate-draw-solid {
          animation: dashSolid .42s ease-out forwards;
        }
        .animate-draw-dotted {
          animation: dashDotted .30s ease-out forwards;
        }
      `}</style>

      <SidebarGroupContent className="flex flex-col gap-3 overflow-visible">
        {/* CTA row */}
        <SidebarMenu className="space-y-3 overflow-visible">
          <SidebarMenuItem className="flex items-center gap-3">
            <SidebarMenuButton
              tooltip="Transfer"
              onClick={() => setTransferOpen(true)}
              className={[
                "min-w-8 rounded-2xl h-10",
                "border-[1px] border-[#FA812F]/50 bg-[#FA812F] text-white",
                "!text-white hover:!text-white hover:!bg-[#FA812F]",
                "shadow-[0_6px_0_0_rgba(250,129,47,0.4)] transition-all ease-out",
                "hover:translate-y-[1px] hover:shadow-[0_4px_0_0_rgba(250,129,47,0.4)]",
                "active:translate-y-[4px] active:shadow-[0_1px_0_0_rgba(250,129,47,0.4)]",
                "focus:outline-none touch-manipulation",
              ].join(" ")}
            >
              <PlusCircleIcon className="stroke-[1.5]" />
              <span>Transfer</span>
            </SidebarMenuButton>

            <Button
              size="icon"
              variant="outline"
              className="relative top-[2px] h-[46px] w-[46px] shrink-0 rounded-2xl border-[1.5px] border-[#FA812F]/50 text-[#FA812F] group-data-[collapsible=icon]:opacity-0 hover:!text-[#FA812F]"
            >
              <MailIcon className="h-[23px] w-[23px]" />
              <span className="sr-only">Mail</span>
            </Button>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* Main nav items — add vertical spacing so underline has room visually */}
        <SidebarMenu className="space-y-1.5 overflow-visible">
          {items.map((item, i) => {
            const isActive = pathname === item.url;
            const variant: Variant = (["a", "b", "c"] as Variant[])[i % 3];
            const d = SQUIGGLES[variant];

            return (
              <SidebarMenuItem key={item.title} className="overflow-visible">
                <NavItem title={item.title} url={item.url} Icon={item.icon} d={d} isActive={!!isActive} />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>

      {/* Mount the transfer dialog once */}
      <TransferDialog open={transferOpen} onOpenChange={setTransferOpen} />
    </SidebarGroup>
  );
}

function NavItem({ title, url, Icon, d, isActive }: { title: string; url: string; Icon?: LucideIcon; d: string; isActive: boolean }) {
  const [hovering, setHovering] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  return (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className="relative !overflow-visible hover:!bg-transparent data-[active=true]:!bg-transparent !text-current"
      tooltip={title}
    >
      <NavLink
        to={url}
        className="flex items-center gap-3 h-10 !overflow-visible no-underline hover:no-underline focus:no-underline"
        onMouseEnter={() => {
          setHovering(true);
          setTick((t) => t + 1);
        }}
        onMouseLeave={() => setHovering(false)}
        onFocus={() => {
          setHovering(true);
          setTick((t) => t + 1);
        }}
        onBlur={() => setHovering(false)}
      >
        {Icon ? <Icon className="text-[var(--rad-orange,#FA812F)] h-5 w-5 shrink-0" /> : null}

        {/* Label wrapper: no padding; absolute underline so text/icon alignment is unchanged */}
        <span className="relative inline-block leading-none text-[var(--rad-orange,#FA812F)] !overflow-visible">
          {title}

          {/* Underline layer positioned under the text, doesn't affect layout */}
          <span className="pointer-events-none absolute left-0 right-0 top-full mt-[4px] h-[10px] z-10 !overflow-visible">
            {/* Dotted on hover (also shows on active hover if you remove the guard) */}
            {!isActive && (
              <svg
                className="block w-full h-full"
                viewBox="0 0 100 6"
                preserveAspectRatio="none"
                aria-hidden="true"
                style={{ opacity: hovering ? 1 : 0, transition: "opacity 120ms linear" }}
              >
                <path
                  key={tick}
                  d={d}
                  fill="none"
                  stroke="var(--rad-orange,#FA812F)"
                  strokeOpacity={0.55}
                  strokeWidth={2.2}
                  strokeLinecap="butt"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                  pathLength={100}
                  className={hovering ? "animate-draw-dotted" : ""}
                  style={{ strokeDasharray: "0.001 4.8", strokeDashoffset: 110, willChange: "stroke-dashoffset" }}
                />
              </svg>
            )}

            {/* Solid active squiggle */}
            <svg className="block w-full h-full" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">
              <path
                d={d}
                fill="none"
                stroke="var(--rad-orange,#FA812F)"
                strokeWidth={2.2}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
                pathLength={100}
                className={isActive ? "animate-draw-solid" : ""}
                style={{
                  strokeDasharray: 100,
                  strokeDashoffset: isActive ? 110 : 0,
                  opacity: isActive ? 1 : 0,
                  willChange: isActive ? "stroke-dashoffset" : undefined,
                }}
              />
            </svg>
          </span>
        </span>
      </NavLink>
    </SidebarMenuButton>
  );
}
