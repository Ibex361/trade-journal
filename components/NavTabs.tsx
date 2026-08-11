"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS } from "@/lib/navTabs";

// Desktop only — mobile navigation is MobileTabBar, a fixed bottom bar
// (the standard mobile-app pattern), not this pill nav shrunk into a
// dropdown. See MobileTabBar.tsx.
export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1 bg-surface-2 backdrop-blur-md rounded-full p-1 border border-surface-border">
      {NAV_TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`px-4 py-1.5 rounded-full text-sm transition-all duration-fast ease-out ${
              active
                ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 font-medium shadow-glow"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
