"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { NAV_TABS } from "@/lib/navTabs";
import { useTradesPageState } from "@/lib/TradesPageStateContext";
import { useNotesPageState } from "@/lib/NotesPageStateContext";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/notes/Popover";
import {
  DashboardIcon,
  TradesIcon,
  AnalyticsIcon,
  StrategiesIcon,
  NotesIcon,
  ReportsIcon,
  SettingsIcon,
  PlusIcon,
  CloseIcon,
  MoreIcon,
} from "@/components/icons";

const ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  "/": DashboardIcon,
  "/trades": TradesIcon,
  "/analytics": AnalyticsIcon,
  "/strategies": StrategiesIcon,
  "/notes": NotesIcon,
  "/reports": ReportsIcon,
  "/settings": SettingsIcon,
};

// The four tabs that get a permanent slot in the bottom bar (chosen over
// the other three so the bar can carry a center FAB, matching the mockup's
// 4-icons-plus-FAB layout). The rest (Analytics, Strategies, Reports) move
// into the "More" popover below — still reachable, just one tap deeper.
// Desktop NavTabs is untouched and keeps showing all of NAV_TABS.
const MOBILE_TAB_HREFS = ["/", "/trades", "/notes", "/settings"];
const MORE_HREFS = ["/analytics", "/strategies", "/reports"];

const LEFT_HREFS = ["/", "/trades"];
const RIGHT_HREFS = ["/notes", "/settings"];

/**
 * Fixed bottom tab bar — the actual mobile navigation pattern, replacing
 * the "current page + dropdown" menu the header used to carry. Grounded in
 * near-black (surface-0) rather than the translucent glass panel tone, so
 * it stays legible sitting over the brightest part of the body gradient.
 * Desktop keeps NavTabs' pill nav in the header instead; this never
 * renders at md and above.
 *
 * Layout: Dashboard, Trades — [center FAB] — Notes, More. The FAB opens a
 * small popover choosing "New trade" / "New note" (mirrors the reference
 * mockup's plus-button pattern); "More" opens a popover listing the three
 * tabs that didn't fit in the bar (Analytics, Strategies, Reports).
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setPendingNewTrade } = useTradesPageState();
  const { setPendingNewNote } = useNotesPageState();
  if (pathname === "/login") return null;

  const moreActive = MORE_HREFS.includes(pathname);

  function renderTab(href: string) {
    const tab = NAV_TABS.find((t) => t.href === href)!;
    const active = pathname === href;
    const Icon = ICONS[href];
    return (
      <Link
        key={href}
        href={href}
        className="relative flex flex-col items-center justify-center gap-1 py-2.5"
      >
        {active && (
          <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-glow to-glow-violet motion-safe:animate-fade-in" />
        )}
        <Icon className={`w-5 h-5 transition-colors duration-fast ${active ? "text-glow" : "text-ink-muted"}`} />
        <span className={`text-[10px] leading-none transition-colors duration-fast ${active ? "text-ink-primary font-medium" : "text-ink-muted"}`}>
          {tab.label}
        </span>
      </Link>
    );
  }

  function handleNewTrade() {
    setPendingNewTrade(true);
    router.push("/trades");
  }

  function handleNewNote() {
    setPendingNewNote(true);
    router.push("/notes");
  }

  return (
    <nav
      className="md:hidden print:hidden fixed bottom-0 inset-x-0 z-30 bg-surface-0/85 backdrop-blur-xl border-t border-surface-border"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative grid grid-cols-5">
        {LEFT_HREFS.map(renderTab)}

        {/* Center FAB slot — the tab bar's own grid cell holds the label-less
            spacer so the 5-column grid still lines up; the actual button is
            absolutely positioned so it can float above the bar's top edge
            like the mockup shows. */}
        <div className="flex items-center justify-center">
          <Popover>
            <PopoverTrigger asChild>
              <button
                aria-label="Create new"
                className="absolute -top-5 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full bg-gradient-to-r from-glow to-glow-violet text-surface-0 shadow-glow flex items-center justify-center transition-transform duration-fast motion-safe:active:scale-95 motion-safe:data-[state=open]:rotate-45"
              >
                <PlusIcon className="w-6 h-6" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="center" sideOffset={14} className="w-44 p-1.5">
              <button
                onClick={handleNewTrade}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-ink-primary hover:bg-surface-2 transition-colors duration-fast"
              >
                <TradesIcon className="w-4 h-4 text-ink-muted" />
                New trade
              </button>
              <button
                onClick={handleNewNote}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm text-ink-primary hover:bg-surface-2 transition-colors duration-fast"
              >
                <NotesIcon className="w-4 h-4 text-ink-muted" />
                New note
              </button>
            </PopoverContent>
          </Popover>
        </div>

        {RIGHT_HREFS.map(renderTab)}

        <Popover>
          <PopoverTrigger asChild>
            <button
              aria-label="More"
              className="relative flex flex-col items-center justify-center gap-1 py-2.5 w-full"
            >
              {moreActive && (
                <span className="absolute top-0 h-0.5 w-8 rounded-full bg-gradient-to-r from-glow to-glow-violet motion-safe:animate-fade-in" />
              )}
              <MoreIcon className={`w-5 h-5 transition-colors duration-fast ${moreActive ? "text-glow" : "text-ink-muted"}`} />
              <span className={`text-[10px] leading-none transition-colors duration-fast ${moreActive ? "text-ink-primary font-medium" : "text-ink-muted"}`}>
                More
              </span>
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={10} className="w-44 p-1.5">
            {MORE_HREFS.map((href) => {
              const tab = NAV_TABS.find((t) => t.href === href)!;
              const Icon = ICONS[href];
              const active = pathname === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-md text-sm transition-colors duration-fast ${
                    active ? "text-glow bg-surface-2" : "text-ink-primary hover:bg-surface-2"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </Link>
              );
            })}
          </PopoverContent>
        </Popover>
      </div>
    </nav>
  );
}
