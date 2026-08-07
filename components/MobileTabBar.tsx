"use client";

import { useEffect, useState } from "react";
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
  HamburgerIcon,
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
// 4-icons-plus-FAB layout). The rest (Analytics, Strategies, Reports) live
// behind the hamburger — still reachable, just one tap deeper.
// Desktop NavTabs is untouched and keeps showing all of NAV_TABS.
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
 * Layout: Dashboard, Trades — [center FAB] — Notes, Settings, with a
 * hamburger as its own trigger at the far right. The FAB opens a small
 * anchored popover (New trade / New note) since that's a 2-item choice
 * that belongs right where the thumb already is. The hamburger opens a
 * full-width bottom sheet (see MoreSheet below) rather than a second
 * anchored popover — a "rest of the app" menu needs room to read as its
 * own surface, not fight for space in a corner flyout. Icon-only, no
 * "More" text label, so it doesn't compete with the labelled primary
 * tabs for attention — this was previously a 5th labelled tab reading
 * "More", which put an overflow affordance at the same visual weight as
 * primary destinations; a dedicated hamburger glyph reads as its own
 * distinct action instead.
 */
export default function MobileTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { setPendingNewTrade } = useTradesPageState();
  const { setPendingNewNote } = useNotesPageState();
  const [moreOpen, setMoreOpen] = useState(false);

  // Close the sheet on route change (tapping a link inside it navigates,
  // but the sheet would otherwise still be mounted/open underneath).
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

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
    <>
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
        </div>

        {/* Hamburger — floats above the tab bar's top-right corner, deliberately
            outside the 5-column grid so it reads as a separate control from the
            primary destinations rather than a 6th tab squeezed in beside them.
            Inspired by the reference mockup's hamburger-at-the-base-of-the-rail
            placement, adapted here to sit above the bar since a fixed bottom bar
            has no "bottom of the rail" of its own to anchor to. */}
        <button
          onClick={() => setMoreOpen(true)}
          aria-label="More navigation"
          aria-expanded={moreOpen}
          className={`absolute -top-5 right-3 w-10 h-10 rounded-full bg-surface-2 backdrop-blur-xl border border-surface-border flex items-center justify-center transition-colors duration-fast active:scale-95 ${
            moreActive ? "text-glow" : "text-ink-muted"
          }`}
        >
          <HamburgerIcon className="w-4 h-4" />
        </button>
      </nav>

      <MoreSheet open={moreOpen} onClose={() => setMoreOpen(false)} pathname={pathname} />
    </>
  );
}

/**
 * Full-width bottom sheet for the three pages that don't fit the tab bar
 * (Analytics, Strategies, Reports). Hand-rolled backdrop + panel in the
 * same style as ConfirmDialog/TradeFormPanel (this app doesn't have a
 * Radix Dialog primitive yet — the existing Popover is built for small
 * anchored content like the FAB's 2-item choice, not a menu that wants
 * room to breathe), rather than reusing the Popover component for a job
 * it isn't shaped for.
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
  // Lock body scroll while the sheet is open, same convention as
  // TradeFormPanel/NoteEditPanel's full-screen surfaces.
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
            const Icon = ICONS[href];
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
