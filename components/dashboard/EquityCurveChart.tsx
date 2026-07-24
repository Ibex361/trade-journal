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
import Card from "@/components/shared/Card";

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
    <div className="bg-surface-2 backdrop-blur-md border border-surface-border rounded-md px-3 py-2 shadow-lg">
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

  return (
    <Card
      title="Equity curve"
      action={
        points.length > 1 && (
          <span className={`font-mono text-sm ${positive ? "text-gain" : "text-loss"}`}>
            {positive ? "+" : ""}
            {change.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
          </span>
        )
      }
    >
      {points.length <= 1 ? (
        <div className="h-64 flex items-center justify-center">
          <p className="text-ink-muted text-sm">Log a trade to start the equity curve.</p>
        </div>
      ) : (
        <div className="h-64">
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
              <Tooltip content={(props: any) => <CustomTooltip {...props} currency={currency} />} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke="url(#equityStroke)"
                strokeWidth={2.2}
                fill="url(#equityFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </Card>
  );
}
