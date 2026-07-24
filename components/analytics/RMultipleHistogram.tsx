"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, Cell } from "recharts";
import { RMultipleBucket } from "@/lib/metrics";
import Card from "@/components/shared/Card";

type TooltipPayloadItem = { payload: RMultipleBucket };

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
  const b = payload[0].payload;
  if (b.count === 0) {
    return (
      <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
        <p className="text-xs text-ink-secondary">{b.label}</p>
        <p className="text-xs text-ink-muted mt-0.5">No trades</p>
      </div>
    );
  }
  const color = b.totalPnl >= 0 ? "text-gain" : "text-loss";
  const sign = b.totalPnl > 0 ? "+" : "";
  return (
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass">
      <p className="text-xs text-ink-secondary">{b.label}</p>
      <p className="font-mono text-sm mt-0.5 text-ink-primary">
        {b.count} trade{b.count === 1 ? "" : "s"}
      </p>
      <p className={`font-mono text-xs mt-0.5 ${color}`}>
        {sign}
        {b.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
      </p>
      <p className="text-[11px] text-glow mt-1">Click to view trades</p>
    </div>
  );
}

export default function RMultipleHistogram({
  buckets,
  currency,
  selectedKey,
  onSelectBucket,
}: {
  buckets: RMultipleBucket[];
  currency: string;
  selectedKey: string | null;
  onSelectBucket: (key: string | null) => void;
}) {
  const hasTrades = buckets.some((b) => b.count > 0);

  return (
    <Card
      title="R-multiple distribution"
      description="How many trades land in each R-multiple range — click a bar to drill in"
    >
      {!hasTrades ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-ink-muted text-sm">No trades with a recorded R-multiple in this range.</p>
        </div>
      ) : (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={buckets} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="rmultBarUp" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#5CE6C8" />
                  <stop offset="100%" stopColor="#5CE6C8" stopOpacity={0.15} />
                </linearGradient>
                <linearGradient id="rmultBarDown" x1="0" y1="0" x2="0" y2="1">
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
                width={35}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: "rgba(255,255,255,0.06)" }}
                content={(props: any) => <CustomTooltip {...props} currency={currency} />}
              />
              <Bar
                dataKey="count"
                radius={[3, 3, 0, 0]}
                style={{ cursor: "pointer" }}
                onClick={(data: any) => {
                  const key = data?.payload?.key ?? data?.key;
                  const count = data?.payload?.count ?? data?.count;
                  if (key && count > 0) onSelectBucket(selectedKey === key ? null : key);
                }}
              >
                {buckets.map((b) => (
                  <Cell
                    key={b.key}
                    fill={b.isLoss ? "url(#rmultBarDown)" : "url(#rmultBarUp)"}
                    opacity={selectedKey == null || selectedKey === b.key ? 1 : 0.35}
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
