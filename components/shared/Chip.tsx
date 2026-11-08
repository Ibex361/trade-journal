/**
 * Compact secondary-stat pill — used wherever a hero panel needs to show a
 * few supporting numbers that don't warrant their own headline treatment
 * (Trades' performance ribbon, Analytics' return hero, Dashboard's stat
 * row). One implementation so the three don't drift in padding/type scale.
 */
export default function Chip({
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
    <div className="flex items-center gap-2 shrink-0 bg-surface-2 border border-surface-border rounded-full pl-3.5 pr-3 py-2">
      <span className="text-[10px] uppercase tracking-wide text-ink-muted whitespace-nowrap">{label}</span>
      <span className={`font-mono text-sm font-medium whitespace-nowrap ${valueClassName}`}>{value}</span>
      {hint && <span className="text-[10px] text-ink-muted whitespace-nowrap hidden sm:inline">{hint}</span>}
    </div>
  );
}
