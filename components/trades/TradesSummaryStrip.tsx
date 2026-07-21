"use client";

import { TradeSummary } from "@/lib/metrics";

function StatCard({
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

export default function TradesSummaryStrip({
  summary,
  currency,
}: {
  summary: TradeSummary;
  currency: string;
}) {
  const pnlClass =
    summary.totalPnl > 0 ? "text-gain" : summary.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = summary.totalPnl > 0 ? "+" : "";

  return (
    <div className="flex flex-wrap gap-3">
      <StatCard label="Trades" value={summary.count.toString()} />
      <StatCard
        label="Total P&L"
        value={`${pnlSign}${summary.totalPnl.toLocaleString(undefined, {
          maximumFractionDigits: 2,
        })} ${currency}`}
        valueClassName={pnlClass}
      />
      <StatCard
        label="Win rate"
        value={summary.winRate != null ? `${summary.winRate.toFixed(0)}%` : "—"}
      />
      <StatCard label="Avg R" value={summary.avgR != null ? summary.avgR.toFixed(2) : "—"} />
    </div>
  );
}
