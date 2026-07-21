"use client";

import { TradeSummary } from "@/lib/metrics";
import StatCard from "@/components/shared/StatCard";

export default function DashboardStats({
  summary,
  currency,
  accountBalance,
}: {
  summary: TradeSummary;
  currency: string;
  accountBalance: number;
}) {
  const pnlClass =
    summary.totalPnl > 0 ? "text-gain" : summary.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = summary.totalPnl > 0 ? "+" : "";

  return (
    <div className="flex flex-wrap gap-3">
      <StatCard
        label="Account balance"
        value={`${accountBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`}
      />
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
      <StatCard label="Trades logged" value={summary.count.toString()} />
    </div>
  );
}
