import { ReactNode } from "react";

/**
 * Groups related fields under a small labeled header with the app's
 * signal-bar motif, so a long form (TradeFormFields) reads as a sequence
 * of named sections instead of one undifferentiated stack of inputs.
 * Purely presentational — no state, safe to reuse anywhere fields need
 * grouping (NoteEditPanel, Settings forms, etc.) later.
 */
export default function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  /** Optional one-line hint shown under the title, muted. */
  description?: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="flex items-baseline gap-2.5 mb-4">
        <span className="signal-bar h-3.5 shrink-0" />
        <h3 className="font-display text-[13px] font-medium tracking-wide text-ink-primary">
          {title}
        </h3>
        {description && (
          <span className="text-[11px] text-ink-muted">{description}</span>
        )}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}
