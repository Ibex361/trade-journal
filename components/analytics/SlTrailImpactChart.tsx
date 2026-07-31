"use client";

import { useCallback, useMemo, memo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine, ResponsiveContainer } from "recharts";
import { SlTrailImpact, pickWinRate } from "@/lib/metrics";
import { useWinRateMode } from "@/lib/WinRateModeContext";
import Card from "@/components/shared/Card";

type Row = SlTrailImpact & {
  /** Win rate under the current WinRateMode for each side, picked once per row so the tooltip and sort don't recompute it. */
  trailedWinRatePicked: number | null;
  heldWinRatePicked: number | null;
  /** Each side's share of the compared sample (trailedCount + heldCount) — 0-1. */
  trailedShare: number;
  heldShare: number;
  /** Win rate × share — a side with a great win rate but a tiny share of the
   * sample can't swing the result the way it would in a raw win-rate
   * subtraction. A null win rate (no trades on that side) contributes 0. */
  weightedTrailed: number;
  weightedHeld: number;
  /** weightedTrailed - weightedHeld, in points. Always defined — see note above. */
  diff: number;
};

type TooltipPayloadItem = { payload: Row };

// Memoized so Recharts' per-mousemove tooltip re-invocation doesn't force a
// fresh render when the hovered strategy hasn't actually changed.
const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload;
  return (
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass min-w-[200px]">
      <p className="text-xs text-ink-secondary">{row.label}</p>
      <p className={`font-mono text-sm mt-0.5 ${row.diff >= 0 ? "text-gain" : "text-loss"}`}>
        {row.diff > 0 ? "+" : ""}
        {row.diff.toFixed(1)} pts
      </p>
      <div className="mt-1.5 space-y-0.5">
        <p className="text-xs text-ink-muted">
          Trailed: {row.trailedWinRatePicked != null ? `${row.trailedWinRatePicked.toFixed(0)}%` : "—"} win ×{" "}
          {(row.trailedShare * 100).toFixed(0)}% share = {row.weightedTrailed.toFixed(1)} pts ({row.trailedCount}{" "}
          trade{row.trailedCount === 1 ? "" : "s"})
        </p>
        <p className="text-xs text-ink-muted">
          Held: {row.heldWinRatePicked != null ? `${row.heldWinRatePicked.toFixed(0)}%` : "—"} win ×{" "}
          {(row.heldShare * 100).toFixed(0)}% share = {row.weightedHeld.toFixed(1)} pts ({row.heldCount} trade
          {row.heldCount === 1 ? "" : "s"})
        </p>
      </div>
      <p className="text-[11px] text-glow mt-1.5">Click to view both groups' trades</p>
    </div>
  );
});

function SlTrailImpactChart({
  rows,
  selectedKey,
  onSelectStrategy,
}: {
  rows: SlTrailImpact[];
  selectedKey: string | null;
  onSelectStrategy: (key: string | null) => void;
}) {
  const { mode } = useWinRateMode();

  const chartRows = useMemo(() => {
    const withDiff: Row[] = rows.map((r) => {
      const trailedWinRatePicked = pickWinRate(
        { winRateStrict: r.trailedWinRateStrict, winRateDecided: r.trailedWinRateDecided },
        mode
      );
      const heldWinRatePicked = pickWinRate(
        { winRateStrict: r.heldWinRateStrict, winRateDecided: r.heldWinRateDecided },
        mode
      );
      // Denominator is just the compared sample (trailed + held) — trades
      // with no sl_movement recorded were never part of either side, so
      // they don't dilute the shares here.
      const sampleCount = r.trailedCount + r.heldCount;
      const trailedShare = sampleCount > 0 ? r.trailedCount / sampleCount : 0;
      const heldShare = sampleCount > 0 ? r.heldCount / sampleCount : 0;
      const weightedTrailed = (trailedWinRatePicked ?? 0) * trailedShare;
      const weightedHeld = (heldWinRatePicked ?? 0) * heldShare;
      return {
        ...r,
        trailedWinRatePicked,
        heldWinRatePicked,
        trailedShare,
        heldShare,
        weightedTrailed,
        weightedHeld,
        diff: weightedTrailed - weightedHeld,
      };
    });
    // Biggest positive impact (trailing helped most) at top, biggest
    // negative at the bottom.
    return withDiff.sort((a, b) => b.diff - a.diff);
  }, [rows, mode]);

  const lopsidedCount = useMemo(
    () => chartRows.filter((r) => r.heldCount === 0).length,
    [chartRows]
  );
  const hasData = chartRows.length > 0;
  const chartHeight = Math.max(120, chartRows.length * 44);

  const handleChartClick = useCallback(
    (state: any) => {
      const row = state?.activePayload?.[0]?.payload;
      const key = row?.key;
      if (key) onSelectStrategy(selectedKey === key ? null : key);
    },
    [onSelectStrategy, selectedKey]
  );

  return (
    <Card
      title="Does trailing the stop help?"
      description="Win rate weighted by each side's share of trailed vs. held trades, by strategy — click a bar to view both groups"
    >
      {!hasData ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-ink-muted text-sm">No strategy in this range has a trailed stop loss yet.</p>
        </div>
      ) : (
        <>
          <div style={{ height: chartHeight }} className="cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartRows}
                layout="vertical"
                margin={{ top: 5, right: 16, left: 0, bottom: 0 }}
                onClick={handleChartClick}
              >
                <CartesianGrid stroke="rgba(255,255,255,0.09)" horizontal={false} />
                <XAxis
                  type="number"
                  domain={[-100, 100]}
                  unit=" pts"
                  tick={{ fill: "#5C6180", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.09)" }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fill: "#5C6180", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={100}
                />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.25)" />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} content={<CustomTooltip />} />
                <Bar dataKey="diff" radius={3} style={{ cursor: "pointer" }} isAnimationActive={false}>
                  {chartRows.map((row) => (
                    <Cell
                      key={row.key}
                      fill={row.diff >= 0 ? "#5CE6C8" : "#FB7185"}
                      opacity={selectedKey == null || selectedKey === row.key ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {lopsidedCount > 0 && (
            <p className="text-[11px] text-ink-muted mt-3">
              {lopsidedCount} strateg{lopsidedCount === 1 ? "y has" : "ies have"} no held-SL trades in this range,
              so its bar reflects the trailed side's win rate at full weight — hover for the exact math.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// Memoized for the same reason as the tooltip above.
export default memo(SlTrailImpactChart);
