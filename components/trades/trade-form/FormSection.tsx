import { CSSProperties, ReactNode } from "react";

/**
 * Groups related fields into a bordered panel card with a compact
 * uppercase header (the app's signal-bar motif as a small tick, not a
 * repeated section-title bullet), so a long form (TradeFormFields) reads
 * as a sequence of distinct instrument panels — closer to a trading
 * terminal's ticket layout — instead of one flat, divider-separated
 * stack. Purely presentational — no state, safe to reuse anywhere fields
 * need grouping (NoteEditPanel, Settings forms, etc.) later.
 *
 * `headerAction` is an optional right-aligned slot in the header row —
 * used by the "Followed rules?" section to put its single toggle inline
 * with the title instead of as a full field row below (see
 * TradeFormFields), since a single yes/no/unset control doesn't need its
 * own field-label treatment.
 *
 * `style`/`className` let one call site (Outcome, in TradeFormFields) add
 * a subtle background wash and border-tint for hero treatment without
 * every section needing its own prop for that.
 */
export default function FormSection({
  title,
  description,
  headerAction,
  children,
  className,
  style,
}: {
  title: string;
  /** Optional one-line hint shown under the title, muted. */
  description?: string;
  headerAction?: ReactNode;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <section className={`panel-card p-4 ${className ?? ""}`} style={style}>
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2.5">
          <span className="signal-bar h-3 shrink-0" />
          <h3 className="font-display text-[11px] font-semibold tracking-wider uppercase text-ink-secondary">
            {title}
          </h3>
          {description && (
            <span className="text-[11px] text-ink-muted normal-case tracking-normal">
              {description}
            </span>
          )}
        </div>
        {headerAction}
      </div>
      {children && <div className="space-y-3.5">{children}</div>}
    </section>
  );
}
