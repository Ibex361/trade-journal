"use client";

import { useMemo } from "react";
import { TradeSummary, MonthlyDayPnl, pickWinRate } from "@/lib/metrics";
import { useWinRateMode, WIN_RATE_MODE_LABELS } from "@/lib/WinRateModeContext";
import Sparkline from "@/components/shared/Sparkline";
import Chip from "@/components/shared/Chip";

/**
 * Replaces the old flat 6-card ReportsSummaryStats. Total P&L for the
 * selected month is the number this page exists to answer, so it gets hero
 * billing plus a day-by-day cumulative trend line — win rate/trades/avg R
 * become secondary chips, the same pattern as Trades' performance ribbon
 * and Analytics' hero. Best/worst day are deliberately dropped here: they
 * now live as a highlighted cell directly on the calendar heatmap below,
 * so the same fact isn't shown twice in two different shapes.
 */
export default function ReportsHero({
  summary,
  dailyPnls,
  currency,
}: {
  summary: TradeSummary;
  dailyPnls: MonthlyDayPnl[];
  currency: string;
}) {
  const { mode } = useWinRateMode();
  const winRate = pickWinRate(summary, mode);
  const pnlClass =
    summary.totalPnl > 0 ? "text-gain" : summary.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = summary.totalPnl > 0 ? "+" : "";

  const cumulative = useMemo(() => {
    let running = 0;
    return dailyPnls.map((d) => (running += d.pnl));
  }, [dailyPnls]);

  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-5 flex flex-col sm:flex-row sm:items-center gap-5">
      <div className="flex items-start gap-3 min-w-0">
        <span className="signal-bar h-11 mt-1 shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide text-ink-secondary whitespace-nowrap">
            Total P&amp;L this month
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
        <Chip label="Trades" value={String(summary.count)} />
        <Chip label="Avg R" value={summary.avgR != null ? summary.avgR.toFixed(2) : "—"} />
      </div>
    </div>
  );
}
