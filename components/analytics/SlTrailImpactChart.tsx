"use client";

import { useCallback, memo } from "react";
import { SlHitRateRow, SlHitRateSegment } from "@/lib/metrics";
import { StopMovement } from "@/lib/trades";
import Card from "@/components/shared/Card";

// Combines a strategy key and a stop-movement type into the single string
// the selection state (and Analytics' clear-on-range-change effect) works
// with, mirroring exitStrategySelectionKey's convention for the same kind
// of two-part selection.
export function slMovementSelectionKey(strategyKey: string, movement: StopMovement): string {
  return `${strategyKey}::${movement}`;
}

// No good/bad color here on purpose — unlike win rate, a higher or lower
// SL-hit rate isn't inherently better or worse out of context, so the three
// groups are just distinguished, not judged.
const MOVEMENT_META: { value: StopMovement; label: string; color: string }[] = [
  { value: "held", label: "Held", color: "#9BA0BE" }, // ink-secondary — the untouched baseline
  { value: "tightened", label: "Tightened", color: "#7C6FF0" }, // glow-violet
  { value: "widened", label: "Widened", color: "#5CE6C8" }, // glow teal
];

function SegmentRow({
  meta,
  segment,
  selected,
  onSelect,
}: {
  meta: (typeof MOVEMENT_META)[number];
  segment: SlHitRateSegment;
  selected: boolean;
  onSelect: () => void;
}) {
  const hasData = segment.count > 0;
  return (
    <button
      type="button"
      onClick={hasData ? onSelect : undefined}
      disabled={!hasData}
      className={`w-full flex items-center gap-2.5 rounded-md px-1.5 py-1 text-left transition-colors ${
        hasData ? "cursor-pointer hover:bg-surface-2" : "cursor-default opacity-45"
      } ${selected ? "bg-surface-2" : ""}`}
    >
      <span className="w-16 shrink-0 text-[11px] text-ink-muted">{meta.label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
        {hasData && (
          <span
            className="block h-full rounded-full"
            style={{ width: `${segment.hitRate}%`, backgroundColor: meta.color }}
          />
        )}
      </span>
      <span className="w-32 shrink-0 text-right font-mono text-xs text-ink-primary">
        {hasData ? `${segment.hitRate!.toFixed(0)}% (${segment.hitCount}/${segment.count})` : "No trades"}
      </span>
    </button>
  );
}

/**
 * How often the stop loss actually got hit, split by whether it was held,
 * tightened, or widened mid-trade — one strategy per row, one bar per
 * movement type within it. Deliberately not a recharts bar chart: each
 * segment's exact rate and trade count are always visible as text rather
 * than hidden behind a hover tooltip (the count matters here, since a rate
 * from 2 trades and a rate from 200 both render the same bar length), and a
 * segment with zero trades reads as "No trades" rather than a
 * visually-identical-to-real-0% empty bar.
 */
function SlTrailImpactChart({
  rows,
  selectedKey,
  onSelectStrategy,
}: {
  rows: SlHitRateRow[];
  selectedKey: string | null;
  onSelectStrategy: (strategyKey: string, movement: StopMovement) => void;
}) {
  const hasData = rows.length > 0;

  const makeSelectHandler = useCallback(
    (strategyKey: string, movement: StopMovement) => () => onSelectStrategy(strategyKey, movement),
    [onSelectStrategy]
  );

  return (
    <Card
      title="Is adjusting your stop helping or hurting you?"
      description="SL-hit rate by stop management: how often the stop actually got hit, by strategy and by whether it was held, tightened, or widened — click a row to view those trades"
    >
      {!hasData ? (
        <div className="h-40 flex items-center justify-center">
          <p className="text-ink-muted text-sm text-center px-4">
            No trades in this range have a stop-management outcome (held, tightened, or widened) recorded yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => (
            <div key={row.key}>
              <p className="mb-1.5 text-xs text-ink-secondary">{row.label}</p>
              <div className="space-y-1">
                {MOVEMENT_META.map((meta) => (
                  <SegmentRow
                    key={meta.value}
                    meta={meta}
                    segment={row[meta.value]}
                    selected={selectedKey === slMovementSelectionKey(row.key, meta.value)}
                    onSelect={makeSelectHandler(row.key, meta.value)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// Memoized so a re-render elsewhere on the page (e.g. another chart's
// hover state) doesn't re-render this whole list.
export default memo(SlTrailImpactChart);
