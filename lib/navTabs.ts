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
  { href: "/reports", label: "Reports" },
  { href: "/settings", label: "Settings" },
];
