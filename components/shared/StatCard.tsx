export default function StatCard({
  label,
  value,
  valueClassName = "",
  hint,
}: {
  label: string;
  value: string;
  valueClassName?: string;
  hint?: string;
}) {
  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass px-4 py-3 flex-1 min-w-[130px]">
      <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className={`font-mono text-lg mt-0.5 font-medium ${valueClassName}`}>{value}</p>
      {hint && <p className="text-[10px] text-ink-muted mt-0.5">{hint}</p>}
    </div>
  );
}
