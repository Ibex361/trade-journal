function Chip({
  label,
  value,
  hint,
  valueClassName = "text-ink-primary",
}: {
  label: string;
  value: string;
  hint?: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2 shrink-0 bg-surface-1 backdrop-blur-md border border-surface-border rounded-full pl-3.5 pr-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-ink-muted whitespace-nowrap">{label}</span>
      <span className={`font-mono text-sm font-medium whitespace-nowrap ${valueClassName}`}>{value}</span>
      {hint && <span className="text-[10px] text-ink-muted whitespace-nowrap hidden sm:inline">{hint}</span>}
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
    <div className="flex gap-2 overflow-x-auto no-scrollbar">
      <Chip label="Win rate" value={winRate != null ? `${winRate.toFixed(0)}%` : "—"} hint={winRateHint} />
      <Chip label="Avg R" value={avgR != null ? avgR.toFixed(2) : "—"} />
      <Chip label="Trades logged" value={tradesCount.toString()} />
    </div>
  );
}
