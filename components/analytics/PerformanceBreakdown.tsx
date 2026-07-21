"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { BREAKDOWN_DIMENSIONS, BreakdownDimension, BreakdownGroup } from "@/lib/metrics";

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
  if (!active || !payload || !payload.length) return null;
  const g = payload[0].payload;
  const color = g.totalPnl >= 0 ? "text-gain" : "text-loss";
  const sign = g.totalPnl > 0 ? "+" : "";
  return (
    <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-ink-secondary">{g.label}</p>
      <p className={`font-mono text-sm mt-0.5 ${color}`}>
        {sign}
        {g.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        {g.winRate != null ? `${g.winRate.toFixed(0)}% win rate` : "No decided trades"} · {g.count} trade
        {g.count === 1 ? "" : "s"}
      </p>
      {g.avgR != null && <p className="text-xs text-ink-muted mt-0.5">Avg R {g.avgR.toFixed(2)}</p>}
      <p className="text-[11px] text-brass mt-1">Click to view trades</p>
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
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="font-display text-base font-medium">{title}</h2>
          <p className="text-ink-muted text-xs mt-0.5">{subtitle}</p>
        </div>
        {dimensions.length > 1 && (
          <div className="inline-flex items-center bg-surface-2 border border-surface-border rounded-full p-1 flex-wrap">
            {dimensions.map((d) => (
              <button
                key={d.value}
                onClick={() => {
                  onDimensionChange(d.value);
                  onSelectGroup(null);
                }}
                className={`px-3 py-1 text-xs font-mono rounded-full transition-colors ${
                  dimension === d.value
                    ? "bg-brass text-surface-0 font-medium"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-ink-muted text-sm">No trades in this range.</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={groups} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#272C34" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#5C636F", fontSize: 11 }}
                axisLine={{ stroke: "#272C34" }}
                tickLine={false}
                interval={0}
                angle={groups.length > 6 ? -35 : 0}
                textAnchor={groups.length > 6 ? "end" : "middle"}
                height={groups.length > 6 ? 50 : 30}
              />
              <YAxis
                tick={{ fill: "#5C636F", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={50}
                tickFormatter={(v: number) => v.toLocaleString(undefined, { notation: "compact" })}
              />
              <Tooltip
                cursor={{ fill: "#1B1F26" }}
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
                    fill={g.totalPnl >= 0 ? "#2BB673" : "#E5484D"}
                    opacity={selectedKey == null || selectedKey === g.key ? 1 : 0.35}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
