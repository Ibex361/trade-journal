"use client";

import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";

/**
 * Shared custom-styled dropdown, replacing native `<select>` app-wide.
 *
 * Why: a native `<select>` can't be styled once it's open — the browser/OS
 * takes over and renders its own picker (this is what prompted the
 * redesign — see trade-journal-webapp memory). Built on
 * @radix-ui/react-select rather than hand-rolled on top of Popover: it's
 * the purpose-built primitive for exactly this control (listbox semantics,
 * roving focus, typeahead, Escape/outside-dismiss, scroll-into-view, and
 * correct behavior on mobile/touch) instead of reimplementing all of that
 * by hand on a generic popover.
 *
 * Visually matches the app's existing `selectClass` convention (bg-surface-2,
 * border-surface-border, text-xs) so every call site keeps its current
 * sizing/spacing — only the open-state rendering changes, from an OS
 * picker to an in-app glass panel consistent with Popover/Modal.
 */

export type SelectOption = {
  value: string;
  label: string;
  /** Orphaned/removed-from-Settings values — same muted treatment the old
   *  native <option style={{color: "#8a8f98"}}> orphan rows used. */
  muted?: boolean;
};

// Radix's Select.Item reserves the empty string internally (it's how the
// primitive represents "nothing selected" for the placeholder state), so
// value="" throws if passed to Item. Every call site in this app uses ""
// as a real, meaningful option ("All", "—", "Any strategy", etc.), so
// rather than push that migration onto every caller, swap "" for this
// sentinel only at the Radix boundary and swap it back on change.
const EMPTY_VALUE_SENTINEL = "__empty__";

export function Select({
  value,
  onChange,
  options,
  placeholder,
  className,
  fullWidth,
  disabled,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Shown when value is "" and no option has value "". */
  placeholder?: string;
  className?: string;
  fullWidth?: boolean;
  disabled?: boolean;
  "aria-label"?: string;
}) {
  const selected = options.find((o) => o.value === value);
  const radixValue = value === "" ? EMPTY_VALUE_SENTINEL : value;

  function handleValueChange(next: string) {
    onChange(next === EMPTY_VALUE_SENTINEL ? "" : next);
  }

  return (
    <SelectPrimitive.Root value={radixValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectPrimitive.Trigger
        aria-label={ariaLabel}
        className={[
          "bg-surface-2 backdrop-blur-md border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary",
          "inline-flex items-center justify-between gap-2",
          "transition-colors duration-fast",
          "hover:border-glow/40 hover:bg-surface-2/80",
          "focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20",
          "data-[state=open]:border-glow/60 data-[state=open]:ring-2 data-[state=open]:ring-glow/20",
          "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-surface-border disabled:hover:bg-surface-2",
          "data-[placeholder]:text-ink-secondary",
          fullWidth ? "w-full" : "",
          className ?? "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span className={`truncate ${selected?.muted ? "text-ink-muted" : ""}`}>
          <SelectPrimitive.Value placeholder={placeholder ?? "Select…"}>
            {selected?.label}
          </SelectPrimitive.Value>
        </span>
        <SelectPrimitive.Icon asChild>
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="w-3.5 h-3.5 text-ink-secondary shrink-0"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={[
            "z-[60] overflow-hidden outline-none",
            "bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass",
            "motion-safe:data-[state=open]:animate-scale-in",
            // Content sizes to its longest label (up to a cap) rather than
            // being locked to the trigger's width — a narrow trigger like a
            // "Strategy" filter shouldn't clip options like "Mean reversion".
            // min-width still matches the trigger so short-label menus don't
            // look undersized relative to the control that opened them.
            "w-max min-w-[var(--radix-select-trigger-width)] max-w-[min(280px,var(--radix-select-content-available-width))]",
            "max-h-[min(320px,var(--radix-select-content-available-height))]",
          ].join(" ")}
        >
          <SelectPrimitive.ScrollUpButton className="flex items-center justify-center py-1 text-ink-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M18 15l-6-6-6 6" />
            </svg>
          </SelectPrimitive.ScrollUpButton>

          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value}
                value={o.value === "" ? EMPTY_VALUE_SENTINEL : o.value}
                className={[
                  "relative flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-xs cursor-pointer select-none outline-none",
                  "data-[highlighted]:bg-glow/15 data-[highlighted]:text-glow",
                  "data-[state=checked]:text-glow",
                  o.muted ? "text-ink-muted" : "text-ink-primary",
                ].join(" ")}
              >
                <SelectPrimitive.ItemText>
                  <span className="break-words">{o.label}</span>
                </SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5 shrink-0">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>

          <SelectPrimitive.ScrollDownButton className="flex items-center justify-center py-1 text-ink-secondary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </SelectPrimitive.ScrollDownButton>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}

export default Select;
