"use client";

import * as React from "react";
import { LucideIcon } from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";
import { SidebarGroup, SidebarGroupContent, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from "@/components/ui/sidebar";

const SQUIGGLES = [
  "M0 3 C 10 6, 25 0, 40 3 S 70 6, 100 3",
  "M0 3 C 8 0, 22 6, 35 3 S 65 0, 100 3",
  "M0 3 C 12 5.5, 28 0.5, 50 3 S 82 5.5, 100 3",
  "M0 3 C 14 6, 30 1, 48 3 S 84 6, 100 3",
  "M0 3 C 9 1, 24 5.5, 38 3 S 72 1, 100 3",
] as const;

export function NavSecondary({
  items,
  ...props
}: {
  items: { title: string; url: string; icon: LucideIcon }[];
} & React.ComponentPropsWithoutRef<typeof SidebarGroup>) {
  const { pathname } = useLocation();

  return (
    <SidebarGroup {...props}>
      <style>{`
        @keyframes dashSolid {
          0%   { stroke-dashoffset: 110; opacity: .2 }
          12%  { opacity: 1 }
          100% { stroke-dashoffset: 0 }
        }
        @keyframes dashDotted {
          0%   { stroke-dashoffset: 110; opacity: 0 }
          10%  { opacity: .5 }
          100% { stroke-dashoffset: 0; opacity: .5 }
        }
        .animate-draw-solid  { animation: dashSolid  .40s ease-out forwards }
        .animate-draw-dotted { animation: dashDotted .30s ease-out forwards }
      `}</style>

      <SidebarGroupContent>
        {/* a touch of vertical room so the underline never clips */}
        <SidebarMenu className="space-y-2 !overflow-visible">
          {items.map((item, i) => {
            const isActive = pathname.startsWith(item.url);
            const d = SQUIGGLES[i % SQUIGGLES.length];

            return (
              <SidebarMenuItem key={item.title} className="!overflow-visible">
                <SecondaryItem title={item.title} url={item.url} Icon={item.icon} d={d} isActive={isActive} />
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

function SecondaryItem({ title, url, Icon, d, isActive }: { title: string; url: string; Icon: LucideIcon; d: string; isActive: boolean }) {
  const [hovering, setHovering] = React.useState(false);
  const [tick, setTick] = React.useState(0);

  return (
    <SidebarMenuButton
      asChild
      isActive={isActive}
      className="relative !overflow-visible hover:!bg-transparent data-[active=true]:!bg-transparent !text-current h-10 px-2"
      tooltip={title}
    >
      <NavLink
        to={url}
        className="group flex items-center gap-2 h-10 !overflow-visible no-underline hover:no-underline focus:no-underline"
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
        <Icon className="text-[var(--rad-orange,#FA812F)] h-5 w-5 shrink-0" />

        {/* Label: no extra padding; underline is absolutely positioned below */}
        <span className="relative inline-block leading-none text-[var(--rad-orange,#FA812F)] !overflow-visible">
          {title}

          {/* Underline layer under the text (doesn't affect layout/alignment) */}
          <span className="pointer-events-none absolute left-0 right-0 top-full mt-[4px] h-[10px] z-10 !overflow-visible">
            {/* Dotted on hover (non-active) */}
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

            {/* Solid active line */}
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
