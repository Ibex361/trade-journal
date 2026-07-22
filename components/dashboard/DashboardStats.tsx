"use client";

import { TradeSummary, Streak, pickWinRate } from "@/lib/metrics";
import { useWinRateMode, WIN_RATE_MODE_LABELS } from "@/lib/WinRateModeContext";
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
  const { mode } = useWinRateMode();
  const winRate = pickWinRate(summary, mode);
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
        value={winRate != null ? `${winRate.toFixed(0)}%` : "—"}
        hint={WIN_RATE_MODE_LABELS[mode]}
      />
      <StatCard label="Avg R" value={summary.avgR != null ? summary.avgR.toFixed(2) : "—"} />
      <StatCard label="Trades logged" value={summary.count.toString()} />
      <StatCard label="Streak" value={streakValue} valueClassName={streakClass} />
    </div>
  );
}
