"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Card from "@/components/shared/Card";
import TradeChartModal from "@/components/trades/trade-chart/TradeChartModal";
import { backtestTradeToTrade, type BacktestTrade } from "@/lib/backtests";
import { formatValue } from "@/lib/backtestAnalysis";
import { reconcileTradeCount } from "@/lib/backtestFormat";
import type { Trade } from "@/lib/trades";

// Rows revealed per step. Presentational only -- every trade is already
// fetched; this just avoids mounting thousands of DOM rows at once (the same
// cap-the-render-not-the-fetch rule the Trades and Notes lists follow).
const PAGE_SIZE = 100;

/**
 * The trades Backtrader closed during a run, each with a "View chart"
 * button. The chart reads candles from the BACKTEST bucket
 * (/api/backtest-chart-data) -- the same files the strategy traded on --
 * so opening one never triggers a tick-archive download and never touches
 * the live sync.
 *
 * `reportedClosed` is Backtrader's own closed-trade count; the table
 * reconciles against it and says so plainly if the numbers differ, rather
 * than letting a silent discrepancy pass as the full picture.
 */
export default function BacktestTradesTable({ trades, reportedClosed }: { trades: BacktestTrade[]; reportedClosed: number | null }) {
  const [revealCount, setRevealCount] = useState(PAGE_SIZE);
  const [chartTrade, setChartTrade] = useState<Trade | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => trades.slice(0, revealCount), [trades, revealCount]);
  const hasMore = revealCount < trades.length;
  const reconciliation = reconcileTradeCount(trades.length, reportedClosed);

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setRevealCount((c) => c + PAGE_SIZE);
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, revealCount]);

  return (
    <>
      <Card
        title="Trades"
        description={
          trades.length === 0
            ? undefined
            : `${trades.length.toLocaleString()} closed trade${trades.length === 1 ? "" : "s"} recorded during the run. Times are shown in your local time (UTC+3).`
        }
      >
        {reconciliation.kind === "mismatch" && (
          <p role="alert" className="mb-4 text-xs text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">
            This table has {reconciliation.shown.toLocaleString()} trades but Backtrader reported {reconciliation.reported.toLocaleString()} closed. The Backtrader
            results above are the authoritative numbers; some trades may be missing from this table.
          </p>
        )}

        {trades.length === 0 ? (
          <p className="text-sm text-ink-muted py-4 text-center">This run didn&apos;t close any trades.</p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-[11px] uppercase tracking-wide text-ink-secondary text-left">
                  <th className="font-medium px-2 py-2">Opened</th>
                  <th className="font-medium px-2 py-2">Closed</th>
                  <th className="font-medium px-2 py-2">Instrument</th>
                  <th className="font-medium px-2 py-2">Side</th>
                  <th className="font-medium px-2 py-2 text-right">Size</th>
                  <th className="font-medium px-2 py-2 text-right">Entry</th>
                  <th className="font-medium px-2 py-2 text-right">Exit</th>
                  <th className="font-medium px-2 py-2 text-right">P&amp;L</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border">
                {visible.map((t) => (
                  <tr key={t.id} className="hover:bg-surface-2/40 transition-colors">
                    <td className="px-2 py-2 font-mono text-xs whitespace-nowrap">
                      {t.entry_date} {t.entry_time?.slice(0, 5) ?? ""}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs whitespace-nowrap text-ink-secondary">
                      {t.exit_date ? `${t.exit_date} ${t.exit_time?.slice(0, 5) ?? ""}` : "—"}
                    </td>
                    <td className="px-2 py-2 font-mono text-xs">{t.instrument}</td>
                    <td className="px-2 py-2 text-xs capitalize">{t.direction ?? "—"}</td>
                    <td className="px-2 py-2 font-mono text-xs text-right">{formatValue(t.size)}</td>
                    <td className="px-2 py-2 font-mono text-xs text-right">{formatValue(t.entry_price)}</td>
                    <td className="px-2 py-2 font-mono text-xs text-right">{formatValue(t.exit_price)}</td>
                    <td className={`px-2 py-2 font-mono text-xs text-right font-medium ${t.pnl > 0 ? "text-gain" : t.pnl < 0 ? "text-loss" : ""}`}>{formatValue(t.pnl)}</td>
                    <td className="px-2 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setChartTrade(backtestTradeToTrade(t))}
                        className="text-xs text-glow hover:underline whitespace-nowrap"
                        aria-label={`View chart for ${t.instrument} trade opened ${t.entry_date} ${t.entry_time ?? ""}`}
                      >
                        View chart
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {hasMore && (
              <div ref={sentinelRef} className="py-4 text-center text-xs text-ink-muted">
                Showing {visible.length.toLocaleString()} of {trades.length.toLocaleString()} — scroll for more
              </div>
            )}
          </div>
        )}
      </Card>

      {chartTrade && <TradeChartModal trade={chartTrade} onClose={() => setChartTrade(null)} chartDataPath="/api/backtest-chart-data" badge="Backtest" />}
    </>
  );
}
