"use client";

import { useCallback, memo } from "react";
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

// Memoized so Recharts' per-mousemove tooltip re-invocation doesn't force a
// fresh render when the active point hasn't actually changed.
const CustomTooltip = memo(function CustomTooltip({ active, payload, currency }: CustomTooltipProps) {
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
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
      <p className="text-xs text-ink-secondary">{label}</p>
      <p className="font-mono text-sm text-ink-primary mt-0.5">
        {point.balance.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
    </div>
  );
});

/**
 * The bare chart, with no Card/title wrapper — just the gradient stroke,
 * axes, grid, and tooltip. Used directly by both hero panels (DashboardHero
 * and AnalyticsHero), each of which folds it into its own custom header
 * instead of giving it a second title bar. Keeping this one implementation
 * means the two pages can never visually drift apart.
 */
export default function EquityCurveGraph({
  points,
  currency,
  height = "h-64",
}: {
  points: EquityPoint[];
  currency: string;
  height?: string;
}) {
  const renderTooltip = useCallback(
    (props: any) => <CustomTooltip {...props} currency={currency} />,
    [currency]
  );

  if (points.length <= 1) {
    return (
      <div className={`${height} flex items-center justify-center`}>
        <p className="text-ink-muted text-sm">Log a trade to start the equity curve.</p>
      </div>
    );
  }

  return (
    <div className={height}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
          <defs>
            {/* Signature two-tone stroke, always teal-to-violet regardless of
                whether the account is up or down over the period — the glow
                itself is the brand, the +/- badge above carries the sentiment. */}
            <linearGradient id="equityStroke" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#7C6FF0" />
              <stop offset="100%" stopColor="#5CE6C8" />
            </linearGradient>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#5CE6C8" stopOpacity={0.38} />
              <stop offset="100%" stopColor="#5CE6C8" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.09)" vertical={false} />
          <XAxis
            dataKey="date"
            tick={{ fill: "#5C6180", fontSize: 11 }}
            axisLine={{ stroke: "rgba(255,255,255,0.09)" }}
            tickLine={false}
            tickFormatter={formatDateLabel}
            minTickGap={40}
          />
          <YAxis
            tick={{ fill: "#5C6180", fontSize: 11 }}
            axisLine={false}
            tickLine={false}
            width={60}
            tickFormatter={(v: number) => v.toLocaleString(undefined, { notation: "compact" })}
          />
          <Tooltip content={renderTooltip} />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="url(#equityStroke)"
            strokeWidth={2.2}
            fill="url(#equityFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
