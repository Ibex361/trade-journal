"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/lib/navTabs";
import { DashboardIcon, TradesIcon, AnalyticsIcon, ReportsIcon, SettingsIcon } from "@/components/icons";

const ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  "/": DashboardIcon,
  "/trades": TradesIcon,
  "/analytics": AnalyticsIcon,
  "/reports": ReportsIcon,
  "/settings": SettingsIcon,
};

/**
 * Fixed bottom tab bar — the actual mobile navigation pattern, replacing
 * the "current page + dropdown" menu the header used to carry. Grounded in
 * near-black (surface-0) rather than the translucent glass panel tone, so
 * it stays legible sitting over the brightest part of the body gradient.
 * Desktop keeps NavTabs' pill nav in the header instead; this never
 * renders at md and above.
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-0/85 backdrop-blur-xl border-t border-surface-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {NAV_TABS.map((tab) => {
          const active = pathname === tab.href;
          const Icon = ICONS[tab.href];
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className="relative flex flex-col items-center justify-center gap-1 py-2.5"
            >
              {active && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-glow to-glow-violet" />
              )}
              <Icon className={`w-5 h-5 ${active ? "text-glow" : "text-ink-muted"}`} />
              <span className={`text-[10px] leading-none ${active ? "text-ink-primary font-medium" : "text-ink-muted"}`}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
