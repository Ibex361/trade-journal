export type NavTab = {
  href: string;
  label: string;
};

// Single source of truth for the app's primary navigation — read by both
// NavTabs (desktop pill nav) and MobileTabBar (mobile bottom bar) so they
// can never list a different set of pages from each other.
export const NAV_TABS: NavTab[] = [
  { href: "/", label: "Dashboard" },
  { href: "/trades", label: "Trades" },
  { href: "/analytics", label: "Analytics" },
  { href: "/strategies", label: "Strategies" },
  { href: "/backtests", label: "Backtests" },
  { href: "/notes", label: "Notes" },
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];

/**
 * Whether `pathname` belongs to the tab at `href`. Exact match for "/"
 * (every path starts with "/", so a prefix match there would light up
 * Dashboard on every page); otherwise the tab is active for its own path
 * AND anything nested beneath it, so /backtests/<id> keeps the Backtests
 * tab highlighted. The trailing-slash guard stops "/tradesX" or
 * "/backtests-old" from matching "/trades" / "/backtests".
 *
 * Every nav surface (NavTabs, AppHeader's More drawer + trigger) goes
 * through this one function so they can't disagree about which tab a
 * nested page belongs to.
 */
export function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
