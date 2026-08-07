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
 * the hamburger stays hidden at md and above; the brand orb is gone
 * entirely (mobile no longer has room for both a hamburger and an orb in
 * the same top-left slot, and desktop's "Trade journal" wordmark reads
 * fine without it).
 *
 * MoreDrawer is rendered as a sibling of <header>, not nested inside it.
 * This matters: the header is `sticky` with `backdrop-blur-xl`, both of
 * which establish their own stacking/containing context. A previous
 * attempt at this exact change nested the sheet's `fixed inset-0`
 * overlay inside that header context, which clipped/mispositioned the
 * sheet and visually cut off page content sitting under the sticky
 * header. Keeping the drawer as a top-level sibling (the same pattern
 * MobileTabBar's older version of this menu already used successfully)
 * avoids that entirely.
 *
 * The overflow menu is a left-side drawer, not a bottom sheet — it opens
 * from the same edge as its hamburger trigger (top-left), matching the
 * side-drawer pattern most native/professional apps use for nav overflow,
 * rather than a bottom sheet (which reads more like an action menu for a
 * single item than "the rest of the app's navigation").
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
    <>
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
      </header>

      <MoreDrawer open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </>
  );
}

/**
 * Left-side nav drawer for the three pages that don't fit the mobile tab
 * bar (Analytics, Strategies, Reports). Slides in from the left edge —
 * same side as the hamburger trigger — rather than up from the bottom,
 * matching how the reference apps this was modeled on treat navigation
 * overflow (a drawer, not an action sheet). Closes on backdrop click,
 * the X button, Escape, or navigating (via the pathname effect above).
 */
function MoreDrawer({
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

  // Escape closes the drawer, same convention as TradeFormPanel's slide-over.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="md:hidden fixed inset-0 z-40">
      <button
        aria-label="Close menu"
        onClick={onClose}
        className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm motion-safe:animate-fade-in"
      />
      <div
        className="absolute inset-y-0 left-0 w-[82%] max-w-xs bg-surface-solid backdrop-blur-xl border-r border-surface-border shadow-glass motion-safe:animate-slide-in-left flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)", paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border">
          <span className="text-sm font-medium text-ink-secondary">More</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-2 transition-colors duration-fast"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>
        <div className="px-2 py-3 overflow-y-auto">
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
