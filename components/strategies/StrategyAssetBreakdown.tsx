"use client";

import { useMemo, useState } from "react";
import { StrategyAssetDirectionRow, STRATEGY_MIN_SAMPLE_SIZE } from "@/lib/metrics";
import { useWinRateMode } from "@/lib/WinRateModeContext";
import Card from "@/components/shared/Card";

type SortKey =
  | "totalPnl"
  | "expectancyR"
  | "winRate"
  | "profitFactor"
  | "payoffRatio"
  | "stdDevR"
  | "maxDrawdownPct"
  | "count";

function formatR(value: number | null): string {
  if (value == null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

function formatRatio(value: number | null): string {
  if (value == null) return "—";
  return value.toFixed(2);
}

function formatPct(value: number | null): string {
  if (value == null) return "—";
  return `${value.toFixed(0)}%`;
}

/**
 * One row per instrument × direction combination within a single strategy
 * — "where does this strategy's edge actually come from". Same metric set
 * and sortable-table UX as StrategyLeaderboard so a strategy's headline
 * row and its breakdown rows read as directly comparable. Phase 2a of the
 * Strategies page: the data/UI piece. Wiring this in as a click-through
 * drill-down from a leaderboard row is Phase 2b — onClose is optional so
 * this component works standalone until then.
 */
export default function StrategyAssetBreakdown({
  strategyLabel,
  rows,
  currency,
  onClose,
}: {
  strategyLabel: string;
  rows: StrategyAssetDirectionRow[];
  currency: string;
  onClose?: () => void;
}) {
  const { mode } = useWinRateMode();
  const [sortKey, setSortKey] = useState<SortKey>("totalPnl");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [reliableOnly, setReliableOnly] = useState(false);

  const lowSampleCount = useMemo(() => rows.filter((r) => r.lowSample).length, [rows]);

  const visibleRows = useMemo(() => {
    const filtered = reliableOnly ? rows.filter((r) => !r.lowSample) : rows;
    const withValue = filtered.map((r) => {
      const value =
        sortKey === "winRate" ? (mode === "strict" ? r.winRateStrict : r.winRateDecided) : (r[sortKey] as number | null);
      return { row: r, value };
    });
    withValue.sort((a, b) => {
      if (a.value == null && b.value == null) return 0;
      if (a.value == null) return 1;
      if (b.value == null) return -1;
      return sortDir === "desc" ? b.value - a.value : a.value - b.value;
    });
    return withValue.map((w) => w.row);
  }, [rows, reliableOnly, sortKey, sortDir, mode]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const header = (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="font-display text-sm font-medium">
          {strategyLabel} <span className="text-ink-muted font-body font-normal">· asset &amp; direction breakdown</span>
        </h3>
        <p className="text-ink-secondary text-xs mt-0.5">Which instruments and which side this strategy actually works on</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-ink-muted hover:text-ink-primary text-xs px-2 py-1 rounded-md hover:bg-surface-2 transition-colors shrink-0"
        >
          Close ✕
        </button>
      )}
    </div>
  );

  if (rows.length === 0) {
    return (
      <Card>
        {header}
        <div className="h-32 flex items-center justify-center">
          <p className="text-ink-muted text-sm mt-4">No trades for this strategy yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="mb-4">{header}</div>
      <div className="flex justify-end mb-3">
        <div className="inline-flex items-center bg-surface-2 backdrop-blur-md border border-surface-border rounded-full p-1">
          <button
            onClick={() => setReliableOnly(false)}
            className={`px-3 py-1 text-xs font-mono rounded-full transition-all duration-fast ease-out ${
              !reliableOnly
                ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 font-medium shadow-glow"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            All ({rows.length})
          </button>
          <button
            onClick={() => setReliableOnly(true)}
            className={`px-3 py-1 text-xs font-mono rounded-full transition-all duration-fast ease-out ${
              reliableOnly
                ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 font-medium shadow-glow"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {STRATEGY_MIN_SAMPLE_SIZE}+ trades ({rows.length - lowSampleCount})
          </button>
        </div>
      </div>

      <div className="overflow-x-auto -mx-2 sm:mx-0">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="border-b border-surface-border text-left text-ink-secondary text-xs uppercase tracking-wide">
              <th className="px-3 py-3">Instrument &amp; direction</th>
              <SortableHeader label="Trades" sortKey="count" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Win %" sortKey="winRate" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Expectancy" sortKey="expectancyR" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Profit factor" sortKey="profitFactor" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Payoff ratio" sortKey="payoffRatio" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Consistency" sortKey="stdDevR" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Max drawdown" sortKey="maxDrawdownPct" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHeader label="Total P&L" sortKey="totalPnl" activeKey={sortKey} dir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody>
            {visibleRows.map((r) => {
              const winRate = mode === "strict" ? r.winRateStrict : r.winRateDecided;
              const pnlColor = r.totalPnl > 0 ? "text-gain" : r.totalPnl < 0 ? "text-loss" : "text-ink-secondary";
              const expectancyColor =
                r.expectancyR == null ? "text-ink-muted" : r.expectancyR > 0 ? "text-gain" : r.expectancyR < 0 ? "text-loss" : "text-ink-secondary";
              return (
                <tr key={r.key} className="border-b border-surface-border last:border-0 hover:bg-surface-2/50 transition-colors">
                  <td className="px-3 py-3 font-medium">
                    <div className="flex items-center gap-2">
                      <span>{r.label}</span>
                      {r.lowSample && (
                        <span
                          className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface-2 text-ink-muted border border-surface-border whitespace-nowrap"
                          title={`Fewer than ${STRATEGY_MIN_SAMPLE_SIZE} trades — treat these numbers as provisional`}
                        >
                          low sample
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right font-mono text-ink-secondary">{r.count}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink-secondary">{formatPct(winRate)}</td>
                  <td className={`px-3 py-3 text-right font-mono ${expectancyColor}`}>{formatR(r.expectancyR)}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink-secondary">{formatRatio(r.profitFactor)}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink-secondary">{formatRatio(r.payoffRatio)}</td>
                  <td className="px-3 py-3 text-right font-mono text-ink-secondary">{formatRatio(r.stdDevR)}</td>
                  <td className="px-3 py-3 text-right font-mono text-loss">
                    {r.maxDrawdownPct != null
                      ? `${r.maxDrawdownPct > 0 ? "-" : ""}${formatPct(r.maxDrawdownPct)}`
                      : "—"}
                  </td>
                  <td className={`px-3 py-3 text-right font-mono ${pnlColor}`}>
                    {r.totalPnl > 0 ? "+" : ""}
                    {r.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lowSampleCount > 0 && !reliableOnly && (
        <p className="text-xs text-ink-muted mt-3">
          {lowSampleCount} combo{lowSampleCount === 1 ? " has" : "s have"} fewer than {STRATEGY_MIN_SAMPLE_SIZE} trades —
          worth taking those numbers with a grain of salt for now.
        </p>
      )}
    </Card>
  );
}

function SortableHeader({
  label,
  sortKey,
  activeKey,
  dir,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  dir: "asc" | "desc";
  onClick: (key: SortKey) => void;
}) {
  const active = activeKey === sortKey;
  return (
    <th className="px-3 py-3 text-right">
      <button
        onClick={() => onClick(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-ink-primary transition-colors ${active ? "text-ink-primary" : ""}`}
      >
        {label}
        {active && <span className="text-glow">{dir === "desc" ? "↓" : "↑"}</span>}
      </button>
    </th>
  );
}
