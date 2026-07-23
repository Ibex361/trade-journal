import type { ReactNode } from "react";

/**
 * The one glass panel every page section should use going forward. Replaces
 * the "bg-surface-1 border border-surface-border rounded-card p-*" recipe
 * that was previously copy-pasted into StatCard, SettingsCard, and most
 * page.tsx files individually.
 *
 * Existing raw divs using that old recipe still work (Step 2's globals.css
 * gives any `rounded-card` element the same blur + shadow), but Step 4
 * should migrate each page to render sections through this component
 * instead as it goes.
 */
export default function Card({
  title,
  description,
  action,
  padding = "normal",
  className = "",
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  padding?: "normal" | "tight" | "none";
  className?: string;
  children: ReactNode;
}) {
  const pad = padding === "none" ? "" : padding === "tight" ? "p-4" : "p-6";

  return (
    <section
      className={`bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass ${pad} ${className}`}
    >
      {(title || action) && (
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-start gap-3">
            {title && <span className="signal-bar h-6 mt-0.5 shrink-0" />}
            <div>
              {title && <h2 className="font-display text-lg font-medium">{title}</h2>}
              {description && (
                <p className="text-ink-secondary text-sm mt-0.5">{description}</p>
              )}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
