"use client";

import { useCallback, memo } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { HoldingTimeBucket, pickWinRate } from "@/lib/metrics";
import { useWinRateMode } from "@/lib/WinRateModeContext";
import Card from "@/components/shared/Card";

type TooltipPayloadItem = { payload: HoldingTimeBucket };

// Memoized so Recharts' per-mousemove tooltip re-invocation doesn't force a
// fresh render (and a fresh context read) when the active bar hasn't changed.
const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
  currency,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
  currency: string;
}) {
  const { mode } = useWinRateMode();
  if (!active || !payload || !payload.length) return null;
  const b = payload[0].payload;
  if (b.count === 0) {
    return (
      <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
        <p className="text-xs text-ink-secondary">{b.label}</p>
        <p className="text-xs text-ink-muted mt-0.5">No trades</p>
      </div>
    );
  }
  const winRate = pickWinRate(b, mode);
  const color = b.totalPnl >= 0 ? "text-gain" : "text-loss";
  const sign = b.totalPnl > 0 ? "+" : "";
  return (
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
      <p className="text-xs text-ink-secondary">Held {b.label}</p>
      <p className={`font-mono text-sm mt-0.5 ${color}`}>
        {sign}
        {b.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        {winRate != null ? `${winRate.toFixed(0)}% win rate` : "No decided trades"} · {b.count} trade
        {b.count === 1 ? "" : "s"}
      </p>
      {b.avgR != null && <p className="text-xs text-ink-muted mt-0.5">Avg R {b.avgR.toFixed(2)}</p>}
      <p className="text-[11px] text-glow mt-1">Click to view trades</p>
    </div>
  );
});

function HoldingTimeChart({
  buckets,
  currency,
  missingCount,
  selectedKey,
  onSelectBucket,
}: {
  buckets: HoldingTimeBucket[];
  currency: string;
  missingCount: number;
  selectedKey: string | null;
  onSelectBucket: (key: string | null) => void;
}) {
  const hasTrades = buckets.some((b) => b.count > 0);

  const renderTooltip = useCallback(
    (props: any) => <CustomTooltip {...props} currency={currency} />,
    [currency]
  );

  const handleChartClick = useCallback(
    (state: any) => {
      const payload = state?.activePayload?.[0]?.payload;
      const key = payload?.key;
      const count = payload?.count;
      if (key && count > 0) onSelectBucket(selectedKey === key ? null : key);
    },
    [onSelectBucket, selectedKey]
  );

  return (
    <Card
      title="Performance by holding time"
      description="P&L by how long a trade was open, from scalps to multi-day swings — click a bar to drill in"
    >
      {!hasTrades ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-ink-muted text-sm max-w-sm text-center">
            No trades with both an entry and exit time logged in this range, so holding time can't be calculated
            yet.
          </p>
        </div>
      ) : (
        <>
          <div className="h-56 cursor-pointer">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }} onClick={handleChartClick}>
                <defs>
                  <linearGradient id="holdBarUp" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5CE6C8" />
                    <stop offset="100%" stopColor="#5CE6C8" stopOpacity={0.15} />
                  </linearGradient>
                  <linearGradient id="holdBarDown" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FB7185" />
                    <stop offset="100%" stopColor="#FB7185" stopOpacity={0.15} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="rgba(255,255,255,0.09)" vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fill: "#5C6180", fontSize: 11 }}
                  axisLine={{ stroke: "rgba(255,255,255,0.09)" }}
                  tickLine={false}
                  interval={0}
                  angle={-35}
                  textAnchor="end"
                  height={50}
                />
                <YAxis
                  tick={{ fill: "#5C6180", fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={50}
                  tickFormatter={(v: number) => v.toLocaleString(undefined, { notation: "compact" })}
                />
                <Tooltip cursor={{ fill: "rgba(255,255,255,0.06)" }} content={renderTooltip} />
                <Bar
                  dataKey="totalPnl"
                  radius={[3, 3, 0, 0]}
                  style={{ cursor: "pointer" }}
                  isAnimationActive={false}
                >
                  {buckets.map((b) => (
                    <Cell
                      key={b.key}
                      fill={b.totalPnl >= 0 ? "url(#holdBarUp)" : "url(#holdBarDown)"}
                      opacity={b.count === 0 ? 0.25 : selectedKey == null || selectedKey === b.key ? 1 : 0.35}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
          {missingCount > 0 && (
            <p className="text-[11px] text-ink-muted mt-3">
              {missingCount} trade{missingCount === 1 ? "" : "s"} in this range {missingCount === 1 ? "is" : "are"}{" "}
              missing an entry or exit time and {missingCount === 1 ? "isn't" : "aren't"} included above.
            </p>
          )}
        </>
      )}
    </Card>
  );
}

// Memoized for the same reason as the tooltip above.
export default memo(HoldingTimeChart);
