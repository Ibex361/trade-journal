"use client";

import * as React from "react";

/**
 * Toolbar primitives — ported from Tiptap's own UI Components library
 * (tiptap-ui-primitive/toolbar, MIT licensed: github.com/ueberdosis/
 * tiptap-ui-components). This version was corrected against the actual
 * source files (toolbar.tsx + toolbar.scss, user-supplied) after an
 * earlier pass had reconstructed the primitive from documentation alone.
 * Known real differences from the upstream source, since this app doesn't
 * have their `useMenuNavigation`/`useComposedRef` hooks or their
 * `Separator` primitive to import as-is:
 * - Roving focus is done here with plain useEffect + manual tabIndex
 *   assignment instead of their shared `useMenuNavigation` hook (which
 *   also backs their dropdown/menu components) and a MutationObserver.
 *   Same end behavior (arrow keys move a single tab stop, Home/End jump
 *   to the ends, disabled items are skipped), different mechanism.
 * - No `data-focus-visible` attribute tracking — relying on the browser's
 *   native `:focus-visible` instead of their explicit focus/blur
 *   listeners that set it by hand.
 * - `ToolbarSeparator` is a self-contained `<span>` here rather than
 *   re-exporting a shared `Separator` primitive component (this app
 *   doesn't have one yet).
 * Fixed in this pass to match the real source: `variant` prop is now
 * "fixed" | "floating" (was wrongly "default" | "floating"); both
 * `Toolbar` and `ToolbarGroup` forward refs via `React.forwardRef`;
 * `ToolbarGroup` has `role="group"`; an empty `ToolbarGroup` collapses to
 * nothing (and hides an adjacent separator) instead of leaving a stray
 * gap — matters for NoteEditor's table group, which renders empty except
 * when the cursor is inside a table; horizontal scroll containment
 * (`overscroll-behavior-x: contain`) added so sliding the toolbar
 * sideways can't bubble into scrolling the page behind it.
 */

function isFocusable(el: Element): el is HTMLElement {
  return (
    el instanceof HTMLElement &&
    !el.hasAttribute("disabled") &&
    el.getAttribute("aria-disabled") !== "true"
  );
}

type BaseProps = React.HTMLAttributes<HTMLDivElement>;

interface ToolbarProps extends BaseProps {
  variant?: "fixed" | "floating";
}

export const Toolbar = React.forwardRef<HTMLDivElement, ToolbarProps>(
  ({ children, className, variant = "fixed", ...props }, forwardedRef) => {
    const innerRef = React.useRef<HTMLDivElement | null>(null);
    // Merges the caller's ref (if any) with the local one this component
    // needs for its own DOM queries — same purpose as the original's
    // useComposedRef, inlined here since this app doesn't have that hook.
    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        innerRef.current = node;
        if (typeof forwardedRef === "function") forwardedRef(node);
        else if (forwardedRef) (forwardedRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [forwardedRef]
    );

    // Single-tab-stop roving focus, same pattern as the original primitive
    // (and any native toolbar — Google Docs, Notion, etc.): only one
    // button in the whole toolbar sits in the page's normal Tab order at a
    // time (tabIndex 0), every other button is tabIndex -1 so Tab skips
    // straight over the toolbar to whatever's next on the page. Arrow
    // keys move which button holds that single tab stop. Runs after every
    // render (not just once) so it stays correct as buttons come and go —
    // e.g. the table toolbar swapping from "Insert table" to the five
    // contextual add/delete-row/column buttons when the cursor moves into
    // a table.
    React.useEffect(() => {
      const container = innerRef.current;
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
    // buttons are skipped over rather than landing focus on a dead
    // control. Tab/Shift+Tab are left alone entirely (no keydown handling
    // for them) so focus moves on to the next thing on the page, matching
    // the documented behavior of the original primitive.
    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const container = innerRef.current;
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
        // focus isn't currently on a toolbar button at all (e.g. arrow
        // key pressed right after a click moved focus elsewhere).
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
        ref={setRefs}
        role="toolbar"
        aria-label="toolbar"
        aria-orientation="horizontal"
        data-variant={variant}
        onKeyDown={handleKeyDown}
        className={[
          "flex items-center gap-1",
          variant === "fixed" ? "overflow-x-auto no-scrollbar overscroll-x-contain" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </div>
    );
  }
);
Toolbar.displayName = "Toolbar";

export const ToolbarGroup = React.forwardRef<HTMLDivElement, BaseProps>(
  ({ children, className, ...props }, ref) => (
    <div
      ref={ref}
      role="group"
      // Collapses to nothing when it has no children — e.g. NoteEditor's
      // table group renders empty except when the cursor is inside a
      // table, and this stops it (and its neighboring separator) from
      // leaving a stray double-gap in the row the rest of the time.
      className={["flex items-center gap-0.5 shrink-0 empty:hidden empty:gap-0", className ?? ""].filter(Boolean).join(" ")}
      {...props}
    >
      {children}
    </div>
  )
);
ToolbarGroup.displayName = "ToolbarGroup";

export const ToolbarSeparator = React.forwardRef<HTMLSpanElement, React.HTMLAttributes<HTMLSpanElement>>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      className={["w-px h-5 bg-surface-border mx-1 shrink-0", className ?? ""].filter(Boolean).join(" ")}
      {...props}
    />
  )
);
ToolbarSeparator.displayName = "ToolbarSeparator";

// Pushes everything after it to the far end of the row — same role as the
// original primitive's <Spacer />, used e.g. to pin a "Save" button to the
// right of a toolbar while the rest stays left-aligned. Not used in
// NoteEditor's fixed toolbar today (every group there is meant to stay in
// reading order, left to right) but exported so it's available the next
// time a toolbar in this app needs a pinned trailing action.
export function Spacer() {
  return <div className="flex-1" />;
}

// Moved here (from a private, non-exported copy inside NoteEditor.tsx) so
// the Color highlight popover can reuse it as a PopoverTrigger's asChild
// target — that needs a real forwarded ref to attach to the underlying
// <button>, which the original NoteEditor.tsx copy didn't provide. Same
// visual treatment and required-onClick shape as before; every one of
// NoteEditor's 22 existing call sites is unaffected. Extra DOM props are
// spread through so a Radix trigger can inject its own onClick/aria/data-*
// attributes alongside this component's own.
export const ToolbarButton = React.forwardRef<
  HTMLButtonElement,
  {
    onClick: () => void;
    active?: boolean;
    disabled?: boolean;
    label: string;
    children: React.ReactNode;
  } & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "disabled" | "children">
>(({ onClick, active, disabled, label, children, className, ...rest }, ref) => {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={[
        "inline-flex items-center justify-center h-8 min-w-8 px-2 rounded-md text-sm font-medium transition-colors duration-fast shrink-0",
        "disabled:opacity-30 disabled:pointer-events-none",
        active
          ? "bg-glow/15 text-glow shadow-[inset_0_0_0_1px_rgba(92,230,200,0.3)]"
          : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
});
ToolbarButton.displayName = "ToolbarButton";
