"use client";

import { useCallback, useMemo, memo } from "react";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { PlannedVsRealizedPoint, PlannedVsRealizedSummary } from "@/lib/metrics";
import Card from "@/components/shared/Card";
import Chip from "@/components/shared/Chip";

type TooltipPayloadItem = { payload: PlannedVsRealizedPoint };

// Memoized so Recharts' per-mousemove tooltip re-invocation doesn't force a
// fresh render when the hovered point hasn't actually changed.
const CustomTooltip = memo(function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload || !payload.length) return null;
  const p = payload[0].payload;
  const metPlan = p.delta >= 0;
  return (
    <div className="bg-surface-popover backdrop-blur-lg border border-surface-border rounded-md px-3 py-2 shadow-glass min-w-[190px]">
      <p className="text-xs text-ink-secondary">
        {p.label}
        {p.strategy ? ` · ${p.strategy}` : ""}
      </p>
      <div className="mt-1.5 space-y-0.5">
        <p className="text-xs text-ink-muted">
          Planned <span className="font-mono text-ink-primary">{p.plannedR.toFixed(2)}R</span>
        </p>
        <p className="text-xs text-ink-muted">
          Realized <span className="font-mono text-ink-primary">{p.realizedR.toFixed(2)}R</span>
        </p>
      </div>
      <p className={`font-mono text-xs mt-1 ${metPlan ? "text-gain" : "text-loss"}`}>
        {p.delta > 0 ? "+" : ""}
        {p.delta.toFixed(2)}R vs. plan
      </p>
      <p className="text-[11px] text-glow mt-1.5">Click to view this trade</p>
    </div>
  );
});

/**
 * Scatter of each trade's planned R (reward from entry to take-profit,
 * weighed against risk from entry to stop loss — the plan set before the
 * trade was managed) against its realized R (what actually happened). A
 * dashed diagonal marks "exactly as planned" — a point sitting on it hit
 * its take-profit precisely, above it means the trade ran further than
 * planned (trailed past target, or closed even better), and below it means
 * the trade fell short of plan (stopped out, closed early, or reversed
 * before reaching target). Teal/coral coloring reuses the gain/loss
 * convention from the rest of Analytics. Only trades with a full plan
 * (entry, stop loss, AND take-profit all recorded) and a realized
 * R-multiple are plotted — see the missing-count note below the chart.
 */
function PlannedVsRealizedRChart({
  points,
  summary,
  missingCount,
  selectedId,
  onSelectPoint,
}: {
  points: PlannedVsRealizedPoint[];
  summary: PlannedVsRealizedSummary;
  missingCount: number;
  selectedId: string | null;
  onSelectPoint: (id: string | null) => void;
}) {
  const hasData = points.length > 0;

  // Both axes share one domain so the "exactly as planned" reference line
  // reads as a true diagonal and points above/below it are directly
  // comparable, rather than each axis auto-scaling independently.
  const domain = useMemo((): [number, number] => {
    if (points.length === 0) return [-1, 2];
    const values = points.flatMap((p) => [p.plannedR, p.realizedR]);
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const pad = Math.max(0.5, (max - min) * 0.12);
    return [Math.floor((min - pad) * 10) / 10, Math.ceil((max + pad) * 10) / 10];
  }, [points]);

  const hitRate =
    points.length > 0 ? (summary.metOrExceededCount / points.length) * 100 : null;

  const handlePointClick = useCallback(
    (data: { payload?: PlannedVsRealizedPoint } | PlannedVsRealizedPoint) => {
      const p: PlannedVsRealizedPoint | undefined =
        "payload" in data && data.payload ? data.payload : (data as PlannedVsRealizedPoint);
      if (p?.id) onSelectPoint(selectedId === p.id ? null : p.id);
    },
    [onSelectPoint, selectedId]
  );

  return (
    <Card
      title="Do you cut winners short or let losers run?"
      description="Planned vs. realized R: each trade's planned reward-to-risk against what it actually realized — click a point to view that trade"
    >
      {hasData && (
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          <Chip label="Avg planned" value={`${summary.avgPlannedR!.toFixed(2)}R`} />
          <Chip
            label="Avg realized"
            value={`${summary.avgRealizedR!.toFixed(2)}R`}
            valueClassName={summary.avgRealizedR! >= 0 ? "text-gain" : "text-loss"}
          />
          <Chip
            label="Avg gap vs. plan"
            value={`${summary.avgDelta! > 0 ? "+" : ""}${summary.avgDelta!.toFixed(2)}R`}
            valueClassName={summary.avgDelta! >= 0 ? "text-gain" : "text-loss"}
          />
          <Chip
            label="Met or beat plan"
            value={`${summary.metOrExceededCount}/${points.length}`}
            hint={hitRate != null ? `${hitRate.toFixed(0)}%` : undefined}
          />
        </div>
      )}

      {!hasData ? (
        <div className="h-56 flex items-center justify-center">
          <p className="text-ink-muted text-sm text-center px-4">
            No trades in this range have both a take-profit price and a realized R-multiple to compare yet.
          </p>
        </div>
      ) : (
        <div className="h-72 cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 10, right: 20, left: 4, bottom: 20 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.09)" />
              <XAxis
                type="number"
                dataKey="plannedR"
                domain={domain}
                tickFormatter={(v) => `${v}R`}
                tick={{ fill: "#5C6180", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.09)" }}
                tickLine={false}
                label={{
                  value: "Planned R",
                  position: "insideBottom",
                  offset: -12,
                  fill: "#5C6180",
                  fontSize: 11,
                }}
              />
              <YAxis
                type="number"
                dataKey="realizedR"
                domain={domain}
                tickFormatter={(v) => `${v}R`}
                tick={{ fill: "#5C6180", fontSize: 11 }}
                axisLine={{ stroke: "rgba(255,255,255,0.09)" }}
                tickLine={false}
                width={44}
                label={{
                  value: "Realized R",
                  angle: -90,
                  position: "insideLeft",
                  fill: "#5C6180",
                  fontSize: 11,
                }}
              />
              <ReferenceLine
                segment={[
                  { x: domain[0], y: domain[0] },
                  { x: domain[1], y: domain[1] },
                ]}
                stroke="rgba(255,255,255,0.28)"
                strokeDasharray="4 4"
                ifOverflow="hidden"
              />
              <ReferenceLine y={0} stroke="rgba(255,255,255,0.12)" />
              <Tooltip
                cursor={{ stroke: "rgba(255,255,255,0.15)", strokeDasharray: "3 3" }}
                content={<CustomTooltip />}
              />
              <Scatter
                data={points}
                isAnimationActive={false}
                onClick={handlePointClick}
                style={{ cursor: "pointer" }}
              >
                {points.map((p) => (
                  <Cell
                    key={p.id}
                    fill={p.delta >= 0 ? "#5CE6C8" : "#FB7185"}
                    opacity={selectedId == null || selectedId === p.id ? 0.85 : 0.25}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      )}
      {missingCount > 0 && (
        <p className="text-[11px] text-ink-muted mt-3">
          {missingCount} trade{missingCount === 1 ? "" : "s"} in this range excluded — no take-profit price set (so
          there&apos;s no plan to compare against) or no realized R-multiple recorded.
        </p>
      )}
    </Card>
  );
}

// Memoized for the same reason as the tooltip above.
export default memo(PlannedVsRealizedRChart);
