export default function StatCard({
  label,
  value,
  valueClassName = "",
}: {
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="bg-surface-1 border border-surface-border rounded-card px-4 py-3 flex-1 min-w-[130px]">
      <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
      <p className={`font-mono text-lg mt-0.5 ${valueClassName}`}>{value}</p>
    </div>
  );
}
