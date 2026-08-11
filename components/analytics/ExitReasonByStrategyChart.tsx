"use client";

import { useCallback, useMemo, memo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from "recharts";
import { EXIT_REASON_META, StrategyExitBreakdown } from "@/lib/metrics";
import { ExitReason } from "@/lib/trades";
import Card from "@/components/shared/Card";

type TooltipPayloadItem = { payload: StrategyExitBreakdown };

// Combines a strategy key and an exit reason into the single string the
// selection state (and Analytics' clear-on-range-change effect) works with,
// mirroring how the other Analytics charts key their selections.
export function exitStrategySelectionKey(strategyKey: string, reason: ExitReason): string {
  return `${strategyKey}::${reason}`;
}

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
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
      <p className="text-xs text-ink-secondary">{row.label}</p>
      <p className="text-xs text-ink-muted mt-0.5 mb-1.5">
        {row.recordedCount} trade{row.recordedCount === 1 ? "" : "s"} with a recorded exit reason
      </p>
      <div className="space-y-0.5">
        {EXIT_REASON_META.map((r) => (
          <div key={r.value} className="flex items-center gap-2 text-xs">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
            <span className="text-ink-secondary flex-1">{r.label}</span>
            <span className="font-mono text-ink-primary">
              {row.counts[r.value]} ({row.pcts[r.value].toFixed(0)}%)
            </span>
          </div>
        ))}
      </div>
      {row.missingCount > 0 && (
        <p className="text-[11px] text-ink-muted mt-1.5">
          +{row.missingCount} more with no exit reason logged
        </p>
      )}
      <p className="text-[11px] text-glow mt-1.5">Click a segment to view those trades</p>
    </div>
  );
});

function ExitReasonByStrategyChart({
  rows,
  selectedKey,
  onSelectSegment,
}: {
  rows: StrategyExitBreakdown[];
  selectedKey: string | null;
  onSelectSegment: (strategyKey: string, reason: ExitReason) => void;
}) {
  const hasData = rows.length > 0;
  // Horizontal bars need height that scales with the number of strategies,
  // not a fixed box — a journal with two strategies shouldn't get the same
  // vertical space as one with eight.
  const chartHeight = Math.max(120, rows.length * 48);

  const makeClickHandler = useCallback(
    (reason: ExitReason) => (data: TooltipPayloadItem) => {
      const row: StrategyExitBreakdown | undefined = data?.payload;
      if (row) onSelectSegment(row.key, reason);
    },
    [onSelectSegment]
  );

  const clickHandlers = useMemo(
    () => Object.fromEntries(EXIT_REASON_META.map((r) => [r.value, makeClickHandler(r.value)])),
    [makeClickHandler]
  );

  return (
    <Card
      title="Which strategies actually work the way you designed them to?"
      description="SL/TP hit rate by strategy: how each strategy's trades actually closed — click a segment to view those trades"
    >
      {!hasData ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-ink-muted text-sm">
            No trades in this range have an exit reason logged yet.
          </p>
        </div>
      ) : (
        <div style={{ height: chartHeight }} className="cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={rows}
              layout="vertical"
              margin={{ top: 5, right: 16, left: 0, bottom: 0 }}
              barCategoryGap={18}
            >
              <CartesianGrid stroke="rgba(255,255,255,0.09)" horizontal={false} />
              <XAxis
                type="number"
                domain={[0, 100]}
                unit="%"
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
              <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} content={<CustomTooltip />} />
              {EXIT_REASON_META.map((r, i) => (
                <Bar
                  key={r.value}
                  dataKey={(row: StrategyExitBreakdown) => row.pcts[r.value]}
                  name={r.label}
                  stackId="exitReason"
                  fill={r.color}
                  radius={i === 0 ? [3, 0, 0, 3] : i === EXIT_REASON_META.length - 1 ? [0, 3, 3, 0] : undefined}
                  style={{ cursor: "pointer" }}
                  isAnimationActive={false}
                  onClick={clickHandlers[r.value]}
                >
                  {rows.map((row) => (
                    <Cell
                      key={row.key}
                      opacity={
                        selectedKey == null || selectedKey === exitStrategySelectionKey(row.key, r.value) ? 1 : 0.3
                      }
                    />
                  ))}
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}

// Memoized for the same reason as the tooltip above.
export default memo(ExitReasonByStrategyChart);
