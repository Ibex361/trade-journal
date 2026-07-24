"use client";

import { useMemo } from "react";
import { Trade } from "@/lib/trades";
import { TradeSummary, pickWinRate } from "@/lib/metrics";
import { useWinRateMode, WIN_RATE_MODE_LABELS } from "@/lib/WinRateModeContext";
import Sparkline from "@/components/shared/Sparkline";
import Chip from "@/components/shared/Chip";

/**
 * Replaces the old TradesSummaryStrip (four identical StatCards, no visual
 * priority between them). Total P&L is the one number this page exists to
 * answer for the *current filter*, so it gets hero billing and a trend
 * line; win rate / avg R are real but secondary, so they read as compact
 * chips the same way Dashboard's StatChipRow treats its secondary stats.
 */
export default function TradesPerformanceRibbon({
  summary,
  currency,
  trades,
}: {
  summary: TradeSummary;
  currency: string;
  trades: Trade[];
}) {
  const { mode } = useWinRateMode();
  const winRate = pickWinRate(summary, mode);
  const pnlClass =
    summary.totalPnl > 0 ? "text-gain" : summary.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = summary.totalPnl > 0 ? "+" : "";

  const cumulative = useMemo(() => {
    const sorted = [...trades].sort(
      (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
    );
    let running = 0;
    return sorted.map((t) => (running += t.pnl));
  }, [trades]);

  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-5 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="flex items-start gap-3 min-w-0">
        <span className="signal-bar h-11 mt-1 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-secondary whitespace-nowrap">
            Total P&amp;L · {summary.count} trade{summary.count === 1 ? "" : "s"} in view
          </p>
          <p className={`font-display text-3xl font-medium mt-1 ${pnlClass}`}>
            {pnlSign}
            {summary.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}{" "}
            <span className="text-lg text-ink-secondary font-body">{currency}</span>
          </p>
        </div>
      </div>

      <div className="w-full sm:w-36 h-10 shrink-0">
        <Sparkline values={cumulative} />
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar">
        <Chip
          label="Win rate"
          value={winRate != null ? `${winRate.toFixed(0)}%` : "—"}
          hint={WIN_RATE_MODE_LABELS[mode]}
        />
        <Chip label="Avg R" value={summary.avgR != null ? summary.avgR.toFixed(2) : "—"} />
      </div>
    </div>
  );
}
