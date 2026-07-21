"use client";

import { TradeSummary, MonthlyDayPnl } from "@/lib/metrics";
import StatCard from "@/components/shared/StatCard";

export default function ReportsSummaryStats({
  summary,
  bestDay,
  worstDay,
  currency,
}: {
  summary: TradeSummary;
  bestDay: MonthlyDayPnl | null;
  worstDay: MonthlyDayPnl | null;
  currency: string;
}) {
  const pnlColor = summary.totalPnl > 0 ? "text-gain" : summary.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = summary.totalPnl > 0 ? "+" : "";

  return (
    <div className="flex flex-wrap gap-3">
      <StatCard
        label="Total P&L"
        value={`${pnlSign}${summary.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`}
        valueClassName={pnlColor}
      />
      <StatCard label="Win rate" value={summary.winRate != null ? `${summary.winRate.toFixed(0)}%` : "—"} />
      <StatCard label="Trades" value={String(summary.count)} />
      <StatCard label="Avg R" value={summary.avgR != null ? summary.avgR.toFixed(2) : "—"} />
      <StatCard
        label="Best day"
        value={bestDay ? `+${bestDay.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}` : "—"}
        valueClassName="text-gain"
      />
      <StatCard
        label="Worst day"
        value={worstDay ? `${worstDay.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}` : "—"}
        valueClassName="text-loss"
      />
    </div>
  );
}
