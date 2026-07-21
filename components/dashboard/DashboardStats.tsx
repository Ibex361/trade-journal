"use client";

import { TradeSummary, Streak } from "@/lib/metrics";
import StatCard from "@/components/shared/StatCard";

export default function DashboardStats({
  summary,
  currency,
  accountBalance,
  streak,
}: {
  summary: TradeSummary;
  currency: string;
  accountBalance: number;
  streak: Streak;
}) {
  const pnlClass =
    summary.totalPnl > 0 ? "text-gain" : summary.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = summary.totalPnl > 0 ? "+" : "";

  const streakClass = streak.type === "win" ? "text-gain" : streak.type === "loss" ? "text-loss" : "text-ink-primary";
  const streakValue =
    streak.count > 0 ? `${streak.count} ${streak.type === "win" ? "W" : "L"}` : "—";

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
      <StatCard label="Streak" value={streakValue} valueClassName={streakClass} />
    </div>
  );
}
