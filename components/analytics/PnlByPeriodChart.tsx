"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { PeriodBucket, PeriodGranularity } from "@/lib/metrics";
import Card from "@/components/shared/Card";

const GRANULARITIES: { value: PeriodGranularity; label: string }[] = [
  { value: "day", label: "Day" },
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
];

type TooltipPayloadItem = { payload: PeriodBucket };

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
  const bucket = payload[0].payload;
  const color = bucket.pnl >= 0 ? "text-gain" : "text-loss";
  const sign = bucket.pnl > 0 ? "+" : "";
  return (
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
      <p className="text-xs text-ink-secondary">{bucket.label}</p>
      <p className={`font-mono text-sm mt-0.5 ${color}`}>
        {sign}
        {bucket.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
      <p className="text-xs text-ink-muted mt-0.5">
        {bucket.count} trade{bucket.count === 1 ? "" : "s"}
      </p>
    </div>
  );
}

export default function PnlByPeriodChart({
  buckets,
  currency,
  granularity,
  onGranularityChange,
}: {
  buckets: PeriodBucket[];
  currency: string;
  granularity: PeriodGranularity;
  onGranularityChange: (g: PeriodGranularity) => void;
}) {
  return (
    <Card
      title="P&L by period"
      action={
        <div className="inline-flex items-center bg-surface-2 backdrop-blur-md border border-surface-border rounded-full p-1">
          {GRANULARITIES.map((g) => (
            <button
              key={g.value}
              onClick={() => onGranularityChange(g.value)}
              className={`px-3 py-1 text-xs font-mono rounded-full transition-all duration-fast ease-out ${
                granularity === g.value
                  ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 font-medium shadow-glow"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      }
    >
      {buckets.length === 0 ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-ink-muted text-sm">No trades in this range.</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="barUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5CE6C8" />
                  <stop offset="100%" stopColor="#5CE6C8" stopOpacity={0.15} />
                </linearGradient>
                <linearGradient id="barDown" x1="0" y1="0" x2="0" y2="1">
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
                minTickGap={20}
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
              <Bar dataKey="pnl" radius={[3, 3, 0, 0]}>
                {buckets.map((b, i) => (
                  <Cell key={i} fill={b.pnl >= 0 ? "url(#barUp)" : "url(#barDown)"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
