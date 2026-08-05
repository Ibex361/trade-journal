"use client";

import { useEffect, useRef } from "react";

/**
 * Toolbar primitives — ported from Tiptap's own UI Components library
 * (tiptap-ui-primitive/toolbar, MIT licensed: github.com/ueberdosis/
 * tiptap-ui-components), adapted from their SCSS-based component into this
 * app's Tailwind/design-token idiom rather than pulled in as a separate
 * styling system.
 *
 * What's replicated from the original:
 * - The same composition pattern: <Toolbar><ToolbarGroup>...buttons...
 *   </ToolbarGroup><ToolbarSeparator /><ToolbarGroup>...</ToolbarGroup>
 *   <Spacer /><ToolbarGroup>...</ToolbarGroup></Toolbar>
 * - Horizontal roving-focus keyboard navigation: ArrowLeft/ArrowRight/Home/
 *   End move focus between controls in the toolbar; disabled controls are
 *   skipped; Tab/Shift+Tab leave the toolbar rather than being trapped in
 *   it. This is the one piece of real, testable "professional editor"
 *   behavior a flat row of plain <button>s doesn't have at all — every
 *   native rich-text toolbar (Google Docs, Notion, the Tiptap reference
 *   itself) behaves this way, so it's the highest-value single thing to
 *   port over first.
 * - `variant` prop ("default" | "floating") from the original API, though
 *   only "default" (the fixed top toolbar) is used here for now —
 *   BubbleToolbar.tsx is a separate, already-floating implementation and
 *   isn't rebuilt on top of this component in this pass.
 *
 * What's intentionally left out for now (not needed by this app yet, can
 * be added later if useful): vertical orientation, `data-plain` styling
 * variant, and the separate Tooltip primitive that normally wraps each
 * Button — this app already shows a native `title` attribute per button,
 * which was judged good enough for now rather than adding a whole new
 * floating-tooltip component in the same pass.
 */

function isFocusable(el: Element): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    !el.hasAttribute("disabled") &&
    el.getAttribute("aria-disabled") !== "true"
  );
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);

  // Single-tab-stop roving focus, same pattern as the original primitive
  // (and any native toolbar — Google Docs, Notion, etc.): only one button
  // in the whole toolbar sits in the page's normal Tab order at a time
  // (tabIndex 0), every other button is tabIndex -1 so Tab skips straight
  // over the toolbar to whatever's next on the page. Arrow keys move which
  // button holds that single tab stop. Runs after every render (not just
  // once) so it stays correct as buttons come and go — e.g. the table
  // toolbar swapping from "Insert table" to the five contextual
  // add/delete-row/column buttons when the cursor moves into a table.
  useEffect(() => {
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>("button")).filter(isFocusable);
    if (items.length === 0) return;
    const alreadyHasTabStop = items.some((item) => item.tabIndex === 0);
    items.forEach((item, index) => {
      item.tabIndex = !alreadyHasTabStop && index === 0 ? 0 : item.tabIndex === 0 ? 0 : -1;
    });
  });

  // Roving focus: arrow keys move between the toolbar's own focusable
  // controls (buttons), Home/End jump to the first/last, and disabled
  // buttons are skipped over rather than landing focus on a dead control.
  // Tab/Shift+Tab are left alone entirely (no keydown handling for them)
  // so focus moves on to the next thing on the page, matching the
  // documented behavior of the original primitive.
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    const container = ref.current;
    if (!container) return;
    const items = Array.from(container.querySelectorAll<HTMLElement>("button")).filter(isFocusable);
    if (items.length === 0) return;

    const currentIndex = items.indexOf(document.activeElement as HTMLElement);
    let nextIndex: number;
    if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = items.length - 1;
    } else {
      const delta = event.key === "ArrowRight" ? 1 : -1;
      // Wraps around either end, and falls back to the first item when
      // focus isn't currently on a toolbar button at all (e.g. arrow key
      // pressed right after a click moved focus elsewhere).
      nextIndex = currentIndex === -1 ? 0 : (currentIndex + delta + items.length) % items.length;
    }
    event.preventDefault();
    items.forEach((item, index) => {
      item.tabIndex = index === nextIndex ? 0 : -1;
    });
    items[nextIndex]?.focus();
  }

  return (
    <div
      ref={ref}
      role="toolbar"
      aria-orientation="horizontal"
      onKeyDown={handleKeyDown}
      className="flex items-center gap-0.5 overflow-x-auto no-scrollbar"
    >
      {children}
    </div>
  );
}

export function ToolbarGroup({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-0.5 shrink-0">{children}</div>;
}

export function ToolbarSeparator() {
  return <span role="separator" aria-orientation="vertical" className="w-px h-5 bg-surface-border mx-1 shrink-0" />;
}

// Pushes everything after it to the far end of the row — same role as the
// original primitive's <Spacer />, used e.g. to pin a "Save" button to the
// right of a toolbar while the rest stays left-aligned. Not used in
// NoteEditor's fixed toolbar today (every group there is meant to stay in
// reading order, left to right) but exported so it's available the next
// time a toolbar in this app needs a pinned trailing action.
export function Spacer() {
  return <div className="flex-1" />;
}
