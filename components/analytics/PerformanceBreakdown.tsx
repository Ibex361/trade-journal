"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { BREAKDOWN_DIMENSIONS, BreakdownDimension, BreakdownGroup, pickWinRate } from "@/lib/metrics";
import { useWinRateMode } from "@/lib/WinRateModeContext";
import Card from "@/components/shared/Card";

type TooltipPayloadItem = { payload: BreakdownGroup };

function CustomTooltip({
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
  const g = payload[0].payload;
  const winRate = pickWinRate(g, mode);
  const color = g.totalPnl >= 0 ? "text-gain" : "text-loss";
  const sign = g.totalPnl > 0 ? "+" : "";
  return (
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
      <p className="text-xs text-ink-secondary">{g.label}</p>
      <p className={`font-mono text-sm mt-0.5 ${color}`}>
        {sign}
        {g.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        {winRate != null ? `${winRate.toFixed(0)}% win rate` : "No decided trades"} · {g.count} trade
        {g.count === 1 ? "" : "s"}
      </p>
      {g.avgR != null && <p className="text-xs text-ink-muted mt-0.5">Avg R {g.avgR.toFixed(2)}</p>}
      <p className="text-[11px] text-glow mt-1">Click to view trades</p>
    </div>
  );
}

export default function PerformanceBreakdown({
  groups,
  currency,
  dimension,
  dimensions = BREAKDOWN_DIMENSIONS,
  onDimensionChange,
  selectedKey,
  onSelectGroup,
  title = "Performance breakdown",
  subtitle = "Win rate, avg R, and P&L by group — click a bar to drill in",
}: {
  groups: BreakdownGroup[];
  currency: string;
  dimension: BreakdownDimension;
  dimensions?: { value: BreakdownDimension; label: string }[];
  onDimensionChange: (d: BreakdownDimension) => void;
  selectedKey: string | null;
  onSelectGroup: (key: string | null) => void;
  title?: string;
  subtitle?: string;
}) {
  return (
    <Card
      title={title}
      description={subtitle}
      action={
        dimensions.length > 1 && (
          <div className="inline-flex items-center bg-surface-2 backdrop-blur-md border border-surface-border rounded-full p-1 flex-wrap">
            {dimensions.map((d) => (
              <button
                key={d.value}
                onClick={() => {
                  onDimensionChange(d.value);
                  onSelectGroup(null);
                }}
                className={`px-3 py-1 text-xs font-mono rounded-full transition-all duration-fast ease-out ${
                  dimension === d.value
                    ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 font-medium shadow-glow"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )
      }
    >
      {groups.length === 0 ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-ink-muted text-sm">No trades in this range.</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groups} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="perfBarUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5CE6C8" />
                  <stop offset="100%" stopColor="#5CE6C8" stopOpacity={0.15} />
                </linearGradient>
                <linearGradient id="perfBarDown" x1="0" y1="0" x2="0" y2="1">
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
                angle={groups.length > 6 ? -35 : 0}
                textAnchor={groups.length > 6 ? "end" : "middle"}
                height={groups.length > 6 ? 50 : 30}
              />
              <YAxis
                tick={{ fill: "#5C6180", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v: number) => v.toLocaleString(undefined, { notation: "compact" })}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                content={(props: any) => <CustomTooltip {...props} currency={currency} />}
              />
              <Bar
                dataKey="totalPnl"
                radius={[3, 3, 0, 0]}
                style={{ cursor: "pointer" }}
                onClick={(data: any) => {
                  const key = data?.payload?.key ?? data?.key;
                  if (key) onSelectGroup(selectedKey === key ? null : key);
                }}
              >
                {groups.map((g) => (
                  <Cell
                    key={g.key}
                    fill={g.totalPnl >= 0 ? "url(#perfBarUp)" : "url(#perfBarDown)"}
                    opacity={selectedKey == null || selectedKey === g.key ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
