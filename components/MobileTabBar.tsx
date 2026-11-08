"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { NAV_TABS } from "@/lib/navTabs";
import { useTradesPageState } from "@/lib/TradesPageStateContext";
import { useNotesPageState } from "@/lib/NotesPageStateContext";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/notes/Popover";
import {
  DashboardIcon,
  TradesIcon,
  NotesIcon,
  SettingsIcon,
  PlusIcon,
} from "@/components/icons";

const ICONS: Record<string, (props: { className?: string }) => JSX.Element> = {
  "/": DashboardIcon,
  "/trades": TradesIcon,
  "/notes": NotesIcon,
  "/settings": SettingsIcon,
};

const LEFT_HREFS = ["/", "/trades"];
const RIGHT_HREFS = ["/notes", "/settings"];

/**
 * Fixed bottom tab bar — Dashboard, Trades, [center FAB], Notes, Settings.
 * The overflow pages (Analytics, Strategies, Reports) and their "More"
 * sheet now live behind the hamburger in AppHeader (top-left, mobile
 * only) rather than a trigger floating above this bar — one overflow
 * entry point instead of two competing controls near the FAB.
 * Desktop keeps NavTabs' pill nav in the header instead; this never
 * renders at md and above.
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setPendingNewTrade } = useTradesPageState();
  const { setPendingNewNote } = useNotesPageState();
  // Radix's Popover (unlike DropdownMenu) doesn't auto-close on an inside
  // item click — only on outside click/Escape. handleNewTrade/handleNewNote
  // navigate away via router.push instead of unmounting this bar (it lives
  // in the root layout, see app/layout.tsx, so it never unmounts on route
  // change), so without an explicit close the popover stayed open and
  // floated over the destination page. Controlling `open` here lets the
  // handlers close it before navigating.
  const [open, setOpen] = useState(false);

  if (pathname === "/login") return null;

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
    setOpen(false);
    setPendingNewTrade(true);
    router.push("/trades");
  }

  function handleNewNote() {
    setOpen(false);
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
            spacer so the grid still lines up; the actual button is
            absolutely positioned so it can float above the bar's top edge
            like the mockup shows. */}
        <div className="flex items-center justify-center">
          <Popover open={open} onOpenChange={setOpen}>
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
      </div>
    </nav>
  );
}
