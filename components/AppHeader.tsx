"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountSwitcher from "@/components/AccountSwitcher";
import NavTabs from "@/components/NavTabs";
import SignOutButton from "@/components/SignOutButton";
import { NAV_TABS } from "@/lib/navTabs";
import { AnalyticsIcon, StrategiesIcon, ReportsIcon, CloseIcon, HamburgerIcon } from "@/components/icons";

const MORE_HREFS = ["/analytics", "/strategies", "/reports"];
const MORE_ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  "/analytics": AnalyticsIcon,
  "/strategies": StrategiesIcon,
  "/reports": ReportsIcon,
};

/**
 * App header. On mobile, the top-left slot that used to hold the brand orb
 * now holds the hamburger trigger for the "More" menu (Analytics,
 * Strategies, Reports) — thumb-reachable real estate near where the
 * mobile bottom tab bar's own hamburger used to float, consolidated here
 * instead so there's a single, obvious entry point for the overflow pages
 * rather than a second floating control competing with the FAB. Desktop
 * is untouched: NavTabs already lists every page as a full pill nav, so
 * the hamburger and orb both stay hidden at md and above.
 */
export default function AppHeader() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  if (pathname === "/login") return null;

  const moreActive = MORE_HREFS.includes(pathname);

  return (
    <header className="print:hidden border-b border-surface-border bg-surface-0/75 backdrop-blur-xl sticky top-0 z-10">
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3 md:py-4 flex items-center justify-between gap-3 md:gap-6">
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            onClick={() => setMoreOpen(true)}
            aria-label="More navigation"
            aria-expanded={moreOpen}
            className={`md:hidden w-8 h-8 -ml-1 rounded-full flex items-center justify-center transition-colors duration-fast active:scale-95 ${
              moreActive ? "text-glow bg-surface-2" : "text-ink-muted hover:text-ink-primary hover:bg-surface-2"
            }`}
          >
            <HamburgerIcon className="w-5 h-5" />
          </button>
          <span className="hidden sm:inline font-display font-medium text-lg tracking-tight">
            Trade journal
          </span>
        </div>
        <NavTabs />
        <div className="flex items-center gap-2 md:gap-3">
          <AccountSwitcher />
          <SignOutButton />
        </div>
      </div>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </header>
  );
}

/**
 * Full-width bottom sheet for the three pages that don't fit the mobile
 * tab bar (Analytics, Strategies, Reports). Relocated here from
 * MobileTabBar — the trigger now lives in the header (top-left, where the
 * brand orb used to sit) instead of floating above the bottom bar, but the
 * sheet itself keeps the same bottom-anchored slide-up presentation since
 * that's still the right shape for a thumb-reachable menu on a phone,
 * regardless of where its trigger is.
 */
function MoreSheet({
  open,
  onClose,
  pathname,
}: {
  open: boolean;
  onClose: () => void;
  pathname: string;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40">
      <button
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm motion-safe:animate-fade-in"
      />
      <div
        className="absolute bottom-0 inset-x-0 bg-surface-solid backdrop-blur-xl border-t border-surface-border rounded-t-panel shadow-glass motion-safe:animate-slide-up"
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 8px)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <span className="text-sm font-medium text-ink-secondary">More</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-2 transition-colors duration-fast"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="px-2 pb-3">
          {MORE_HREFS.map((href) => {
            const tab = NAV_TABS.find((t) => t.href === href)!;
            const Icon = MORE_ICONS[href];
            const active = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-4 py-3.5 rounded-lg text-sm transition-colors duration-fast ${
                  active ? "text-glow bg-surface-2" : "text-ink-primary hover:bg-surface-2"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className={active ? "font-medium" : ""}>{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
