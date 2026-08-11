import type { InputHTMLAttributes } from "react";

/**
 * Prepared for Step 4 — nothing in Step 3's scope (header/nav/StatCard) has
 * a text input, so this isn't wired into any page yet. The Trades filter
 * bar, trade form, and Settings forms all currently use raw
 * "bg-surface-0 border border-surface-border rounded-md" inputs directly;
 * swap those to this component as each page gets its pass.
 */
export default function Input({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20 transition-colors ${className}`}
      {...props}
    />
  );
}
