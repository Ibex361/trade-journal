"use client";

import { TradeSummary, pickWinRate } from "@/lib/metrics";
import { useWinRateMode, WIN_RATE_MODE_LABELS } from "@/lib/WinRateModeContext";
import StatCard from "@/components/shared/StatCard";

export default function TradesSummaryStrip({
  summary,
  currency,
}: {
  summary: TradeSummary;
  currency: string;
}) {
  const { mode } = useWinRateMode();
  const winRate = pickWinRate(summary, mode);
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
        value={winRate != null ? `${winRate.toFixed(0)}%` : "—"}
        hint={WIN_RATE_MODE_LABELS[mode]}
      />
      <StatCard label="Avg R" value={summary.avgR != null ? summary.avgR.toFixed(2) : "—"} />
    </div>
  );
}
