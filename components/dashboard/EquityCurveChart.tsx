"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { EquityPoint } from "@/lib/metrics";

function formatDateLabel(d: string) {
  if (d === "start") return "";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

type CustomTooltipProps = {
  active?: boolean;
  payload?: { payload: EquityPoint }[];
  currency: string;
};

function CustomTooltip({ active, payload, currency }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;
  const point = payload[0].payload as EquityPoint;
  const label =
    point.date === "start"
      ? "Starting balance"
      : new Date(point.date + "T00:00:00").toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        });

  return (
    <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2 shadow-lg">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="font-mono text-sm text-ink-primary mt-0.5">
        {point.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
    </div>
  );
}

export default function EquityCurveChart({
  points,
  currency,
}: {
  points: EquityPoint[];
  currency: string;
}) {
  const first = points[0]?.balance ?? 0;
  const last = points[points.length - 1]?.balance ?? 0;
  const change = last - first;
  const positive = change >= 0;
  const color = positive ? "#2BB673" : "#E5484D";

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-medium">Equity curve</h2>
        {points.length > 1 && (
          <span className={`font-mono text-sm ${positive ? "text-gain" : "text-loss"}`}>
            {positive ? "+" : ""}
            {change.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
          </span>
        )}
      </div>

      {points.length <= 1 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-ink-muted text-sm">Log a trade to start the equity curve.</p>
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#272C34" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fill: "#5C636F", fontSize: 11 }}
                axisLine={{ stroke: "#272C34" }}
                tickLine={false}
                tickFormatter={formatDateLabel}
                minTickGap={40}
              />
              <YAxis
                tick={{ fill: "#5C636F", fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={60}
                tickFormatter={(v: number) => v.toLocaleString(undefined, { notation: "compact" })}
              />
              <Tooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={color}
                strokeWidth={2}
                fill="url(#equityFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
