"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_TABS, isTabActive } from "@/lib/navTabs";

// Desktop only — mobile navigation is MobileTabBar, a fixed bottom bar
// (the standard mobile-app pattern), not this pill nav shrunk into a
// dropdown. See MobileTabBar.tsx.
export default function NavTabs() {
  const pathname = usePathname();

  return (
    <nav className="hidden md:flex items-center gap-1">
      {NAV_TABS.map((tab) => {
        const active = isTabActive(pathname, tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`relative px-3 py-2 text-sm transition-colors duration-fast ease-out after:absolute after:inset-x-3 after:-bottom-[17px] after:h-0.5 after:rounded-full after:transition-colors ${
              active
                ? "text-ink-primary after:bg-glow"
                : "text-ink-secondary hover:text-ink-primary after:bg-transparent"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
