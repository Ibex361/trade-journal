function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="px-4 sm:px-6 py-4 first:pl-5 sm:first:pl-7 min-w-0">
      <p className="text-[11px] uppercase tracking-[0.08em] text-ink-muted whitespace-nowrap">{label}</p>
      <p className="font-display text-4xl leading-none mt-2 tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-ink-muted mt-1.5 hidden sm:block truncate">{hint}</p>}
    </div>
  );
}

/**
 * The secondary stats — win rate, avg R, trades logged — that don't need
 * hero billing but should still be scannable at a glance. A horizontal,
 * pill-shaped row reads as "supporting detail" the way the old full-width
 * StatCard grid didn't; it also degrades gracefully to a scroll on narrow
 * phones instead of wrapping into a ragged multi-row grid.
 */
export default function StatChipRow({
  winRate,
  winRateHint,
  avgR,
  tradesCount,
}: {
  winRate: number | null;
  winRateHint: string;
  avgR: number | null;
  tradesCount: number;
}) {
  return (
    <div className="grid grid-cols-3 divide-x divide-surface-border bg-surface-1 border border-surface-border rounded-panel shadow-glass">
      <Stat label="Win rate" value={winRate != null ? `${winRate.toFixed(0)}%` : "—"} hint={winRateHint} />
      <Stat label="Avg R" value={avgR != null ? avgR.toFixed(2) : "—"} />
      <Stat label="Trades" value={tradesCount.toString()} />
    </div>
  );
}
