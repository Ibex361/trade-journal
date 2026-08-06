"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";

/**
 * Popover primitive — ported from Tiptap's own UI Components library
 * (tiptap-ui-primitive/popover, MIT licensed: github.com/ueberdosis/
 * tiptap-ui-components), built directly on the same underlying package
 * their real source uses (@radix-ui/react-popover) rather than a
 * hand-rolled alternative — this is real positioning/focus-trap/
 * dismiss-on-outside-click logic worth not reimplementing badly.
 *
 * Real differences from their source:
 * - Their version's className is `tiptap-popover`, styled via a
 *   dedicated popover.scss keyed to their own design tokens
 *   (--tt-popover-bg-color etc., light/dark pairs). This version is
 *   styled directly with this app's existing Tailwind glass/blur
 *   classes (bg-surface-solid, border-surface-border, shadow-glass —
 *   the same classes BubbleToolbar.tsx and LinkDialog.tsx already use)
 *   instead of introducing a parallel token system for one component.
 * - Their version has no light/dark split to adapt since this app is
 *   dark-theme-only (see app/globals.css — `color-scheme: dark`, no
 *   toggle).
 * - Their scss defines slide/fade-in animations keyed off Radix's
 *   `data-state`/`data-side` attributes; this version uses Tailwind's
 *   existing `animate-scale-in`/`animate-fade-in` utility classes
 *   (already defined in this app's tailwind config, used by
 *   LinkDialog.tsx) rather than porting a second animation system.
 */

export const Popover = PopoverPrimitive.Root;
export const PopoverTrigger = PopoverPrimitive.Trigger;

export const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, ...props }, ref) => (
  <PopoverPrimitive.Portal>
    <PopoverPrimitive.Content
      ref={ref}
      align={align}
      sideOffset={sideOffset}
      className={[
        "z-[60] outline-none",
        "bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass",
        "motion-safe:data-[state=open]:animate-scale-in",
        className ?? "",
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  </PopoverPrimitive.Portal>
));
PopoverContent.displayName = "PopoverContent";
