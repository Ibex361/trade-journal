"use client";

import { Trade } from "@/lib/trades";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function PnlText({ value }: { value: number }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono ${color}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

function RulesBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-ink-muted text-xs">—</span>;
  return value ? (
    <span className="text-gain text-xs">Yes</span>
  ) : (
    <span className="text-loss text-xs">No</span>
  );
}

/**
 * Chronological, read-only trade list for a single month. Used on the
 * Reports page itself and, unchanged, in the printed report — this is why
 * it has no edit/delete actions or screenshot column.
 */
export default function MonthlyTradesTable({ trades }: { trades: Trade[] }) {
  const sorted = [...trades].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
  );

  if (sorted.length === 0) {
    return (
      <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center print:border-0 print:p-4">
        <p className="text-ink-muted text-sm">No trades logged this month.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop / print table */}
      <div className="hidden md:block print:block bg-surface-1 border border-surface-border rounded-card overflow-hidden print:border-0 print:rounded-none">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-ink-secondary text-xs uppercase tracking-wide print:border-b-2">
              <th className="px-4 py-3 print:px-2 print:py-1.5">Date</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5">Instrument</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5">Dir</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5 hidden lg:table-cell print:table-cell">Strategy</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5 hidden lg:table-cell print:table-cell">Session</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5 text-right">P&L</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5 text-right">R</th>
              <th className="px-4 py-3 print:px-2 print:py-1.5">Rules</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr
                key={t.id}
                className="border-b border-surface-border last:border-0 hover:bg-surface-2/50 transition-colors print:hover:bg-transparent"
              >
                <td className="px-4 py-3 print:px-2 print:py-1 font-mono text-ink-secondary whitespace-nowrap">
                  {formatDate(t.entry_date)}
                </td>
                <td className="px-4 py-3 print:px-2 print:py-1 font-medium">{t.instrument}</td>
                <td className="px-4 py-3 print:px-2 print:py-1 capitalize text-ink-secondary">
                  {t.direction ?? "—"}
                </td>
                <td className="px-4 py-3 print:px-2 print:py-1 text-ink-secondary hidden lg:table-cell print:table-cell">
                  {t.strategy ?? "—"}
                </td>
                <td className="px-4 py-3 print:px-2 print:py-1 text-ink-secondary hidden lg:table-cell print:table-cell">
                  {t.session ?? "—"}
                </td>
                <td className="px-4 py-3 print:px-2 print:py-1 text-right">
                  <PnlText value={t.pnl} />
                </td>
                <td className="px-4 py-3 print:px-2 print:py-1 text-right font-mono text-ink-secondary">
                  {t.r_multiple !== null ? t.r_multiple.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3 print:px-2 print:py-1">
                  <RulesBadge value={t.rules_followed} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards (screen only — print always uses the table above) */}
      <div className="md:hidden print:hidden space-y-3">
        {sorted.map((t) => (
          <div key={t.id} className="bg-surface-1 border border-surface-border rounded-card p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="signal-bar h-8" />
                <div>
                  <p className="font-medium">{t.instrument}</p>
                  <p className="text-xs text-ink-secondary font-mono">
                    {formatDate(t.entry_date)} · <span className="capitalize">{t.direction ?? "—"}</span>
                  </p>
                </div>
              </div>
              <PnlText value={t.pnl} />
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ink-secondary">
              {t.strategy && <span>{t.strategy}</span>}
              {t.session && <span>{t.session}</span>}
              {t.r_multiple !== null && <span className="font-mono">{t.r_multiple.toFixed(1)}R</span>}
              <span className="flex items-center gap-1">
                Rules: <RulesBadge value={t.rules_followed} />
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
