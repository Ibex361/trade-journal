"use client";

import { useCallback, useMemo, useState } from "react";
import { Trade, ExitReason, StopMovement } from "@/lib/trades";
import {
  getRMultipleDistribution,
  getTradesInRMultipleBucket,
  countMissingRMultiple,
  getPlannedVsRealizedR,
  summarizePlannedVsRealizedR,
  countMissingPlannedR,
  getPerformanceByHour,
  getTradesInHourBucket,
  countMissingTimeOfDay,
  TimeOfDaySource,
  getPerformanceByHoldingTime,
  getTradesInHoldingTimeBucket,
  countMissingHoldingTime,
  getExitReasonByStrategy,
  getTradesInStrategyExitGroup,
  EXIT_REASON_META,
  getSlHitRateByStrategy,
  getTradesInSlMovementGroup,
} from "@/lib/metrics";
import RMultipleHistogram from "@/components/analytics/RMultipleHistogram";
import PlannedVsRealizedRChart from "@/components/analytics/PlannedVsRealizedRChart";
import TimeOfDayChart from "@/components/analytics/TimeOfDayChart";
import HoldingTimeChart from "@/components/analytics/HoldingTimeChart";
import ExitReasonByStrategyChart, {
  exitStrategySelectionKey,
} from "@/components/analytics/ExitReasonByStrategyChart";
import SlTrailImpactChart, { slMovementSelectionKey } from "@/components/analytics/SlTrailImpactChart";
import BreakdownDrilldown from "@/components/analytics/BreakdownDrilldown";
import Card from "@/components/shared/Card";

/**
 * Strategies Phase 3: the Analytics charts (R-multiple distribution,
 * planned-vs-realized R, time-of-day, holding-time, and the two SL/TP
 * charts) reused as a per-strategy view. Every chart and its underlying
 * metrics.ts function already just takes a flat Trade[] — so this panel's
 * only job is to receive the trades already filtered to one strategy (by
 * the parent, using the same `t.strategy ?? "unspecified"` key the
 * leaderboard uses) and re-run each existing chart against that narrower
 * set. Selection/drilldown state is local to this panel, deliberately not
 * lifted into AnalyticsPageStateContext — it belongs to whichever strategy
 * is currently expanded, and naturally resets when the parent unmounts
 * this panel (strategy deselected or account switched).
 */
export default function StrategyChartsPanel({
  strategyKey,
  strategyLabel,
  trades,
  currency,
}: {
  strategyKey: string;
  strategyLabel: string;
  trades: Trade[];
  currency: string;
}) {
  const [selectedRBucketKey, setSelectedRBucketKey] = useState<string | null>(null);
  const [timeOfDaySource, setTimeOfDaySource] = useState<TimeOfDaySource>("entry");
  const [selectedHourKey, setSelectedHourKey] = useState<string | null>(null);
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null);
  const [selectedExitReason, setSelectedExitReason] = useState<ExitReason | null>(null);
  const [selectedSlMovement, setSelectedSlMovement] = useState<StopMovement | null>(null);
  const [selectedPlannedRId, setSelectedPlannedRId] = useState<string | null>(null);

  const rBuckets = useMemo(() => getRMultipleDistribution(trades), [trades]);
  const missingRMultipleCount = useMemo(() => countMissingRMultiple(trades), [trades]);
  const rDrilldownTrades = useMemo(
    () => (selectedRBucketKey ? getTradesInRMultipleBucket(trades, selectedRBucketKey) : []),
    [trades, selectedRBucketKey]
  );
  const selectedRBucket = useMemo(
    () => rBuckets.find((b) => b.key === selectedRBucketKey) ?? null,
    [rBuckets, selectedRBucketKey]
  );

  const hourBuckets = useMemo(() => getPerformanceByHour(trades, timeOfDaySource), [trades, timeOfDaySource]);
  const missingTimeOfDayCount = useMemo(
    () => countMissingTimeOfDay(trades, timeOfDaySource),
    [trades, timeOfDaySource]
  );
  const hourDrilldownTrades = useMemo(
    () => (selectedHourKey ? getTradesInHourBucket(trades, timeOfDaySource, selectedHourKey) : []),
    [trades, timeOfDaySource, selectedHourKey]
  );
  const selectedHourBucket = useMemo(
    () => hourBuckets.find((b) => b.key === selectedHourKey) ?? null,
    [hourBuckets, selectedHourKey]
  );

  const holdingBuckets = useMemo(() => getPerformanceByHoldingTime(trades), [trades]);
  const missingHoldingTimeCount = useMemo(() => countMissingHoldingTime(trades), [trades]);
  const holdingDrilldownTrades = useMemo(
    () => (selectedHoldingKey ? getTradesInHoldingTimeBucket(trades, selectedHoldingKey) : []),
    [trades, selectedHoldingKey]
  );
  const selectedHoldingBucket = useMemo(
    () => holdingBuckets.find((b) => b.key === selectedHoldingKey) ?? null,
    [holdingBuckets, selectedHoldingKey]
  );

  // Filtering to one strategy's trades before calling the same
  // by-strategy metric functions Analytics uses collapses them down to
  // (at most) a single row/group for that strategy — the chart components
  // themselves don't need to know they're looking at a narrower slice.
  const exitStrategyRows = useMemo(() => getExitReasonByStrategy(trades), [trades]);
  const exitStrategyDrilldownTrades = useMemo(
    () => (selectedExitReason ? getTradesInStrategyExitGroup(trades, strategyKey, selectedExitReason) : []),
    [trades, strategyKey, selectedExitReason]
  );
  const selectedExitReasonLabel = useMemo(() => {
    if (!selectedExitReason) return "";
    return EXIT_REASON_META.find((r) => r.value === selectedExitReason)?.label ?? "";
  }, [selectedExitReason]);
  const onSelectExitStrategySegment = useCallback(
    (_key: string, reason: ExitReason) => {
      setSelectedExitReason((prev) => (prev === reason ? null : reason));
    },
    []
  );
  const closeExitStrategyDrilldown = useCallback(() => setSelectedExitReason(null), []);

  const slHitRateRows = useMemo(() => getSlHitRateByStrategy(trades), [trades]);
  const slMovementDrilldownTrades = useMemo(
    () => (selectedSlMovement ? getTradesInSlMovementGroup(trades, strategyKey, selectedSlMovement) : []),
    [trades, strategyKey, selectedSlMovement]
  );
  const selectedSlMovementLabel = useMemo(() => {
    if (!selectedSlMovement) return "";
    return `${selectedSlMovement.charAt(0).toUpperCase()}${selectedSlMovement.slice(1)} SL`;
  }, [selectedSlMovement]);
  const onSelectSlMovementSegment = useCallback(
    (_key: string, movement: StopMovement) => {
      setSelectedSlMovement((prev) => (prev === movement ? null : movement));
    },
    []
  );
  const closeSlTrailDrilldown = useCallback(() => setSelectedSlMovement(null), []);

  const plannedVsRealizedPoints = useMemo(() => getPlannedVsRealizedR(trades), [trades]);
  const plannedVsRealizedSummary = useMemo(
    () => summarizePlannedVsRealizedR(plannedVsRealizedPoints),
    [plannedVsRealizedPoints]
  );
  const missingPlannedRCount = useMemo(() => countMissingPlannedR(trades), [trades]);
  const selectedPlannedRPoint = useMemo(
    () => (selectedPlannedRId ? plannedVsRealizedPoints.find((p) => p.id === selectedPlannedRId) ?? null : null),
    [plannedVsRealizedPoints, selectedPlannedRId]
  );
  const selectedPlannedRTrade = useMemo(
    () => (selectedPlannedRId ? trades.find((t) => t.id === selectedPlannedRId) ?? null : null),
    [trades, selectedPlannedRId]
  );
  const closePlannedRDrilldown = useCallback(() => setSelectedPlannedRId(null), []);

  const closeRBucketDrilldown = useCallback(() => setSelectedRBucketKey(null), []);
  const closeHourDrilldown = useCallback(() => setSelectedHourKey(null), []);
  const closeHoldingDrilldown = useCallback(() => setSelectedHoldingKey(null), []);

  if (trades.length === 0) {
    return (
      <Card title={`${strategyLabel} · charts`}>
        <div className="h-24 flex items-center justify-center">
          <p className="text-ink-muted text-sm">No trades for this strategy yet.</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="signal-bar h-5 shrink-0" />
        <h3 className="font-display text-sm font-medium text-ink-secondary">
          {strategyLabel} <span className="text-ink-muted font-normal">· charts</span>
        </h3>
      </div>

      <RMultipleHistogram
        buckets={rBuckets}
        currency={currency}
        missingCount={missingRMultipleCount}
        selectedKey={selectedRBucketKey}
        onSelectBucket={setSelectedRBucketKey}
      />
      {selectedRBucket && (
        <BreakdownDrilldown
          groupLabel={selectedRBucket.label}
          trades={rDrilldownTrades}
          currency={currency}
          onClose={closeRBucketDrilldown}
        />
      )}

      <PlannedVsRealizedRChart
        points={plannedVsRealizedPoints}
        summary={plannedVsRealizedSummary}
        missingCount={missingPlannedRCount}
        selectedId={selectedPlannedRId}
        onSelectPoint={setSelectedPlannedRId}
      />
      {selectedPlannedRPoint && selectedPlannedRTrade && (
        <BreakdownDrilldown
          groupLabel={`${selectedPlannedRPoint.label} · planned ${selectedPlannedRPoint.plannedR.toFixed(
            2
          )}R vs. realized ${selectedPlannedRPoint.realizedR.toFixed(2)}R`}
          trades={[selectedPlannedRTrade]}
          currency={currency}
          onClose={closePlannedRDrilldown}
        />
      )}

      <TimeOfDayChart
        buckets={hourBuckets}
        currency={currency}
        source={timeOfDaySource}
        onSourceChange={setTimeOfDaySource}
        missingCount={missingTimeOfDayCount}
        selectedKey={selectedHourKey}
        onSelectBucket={setSelectedHourKey}
      />
      {selectedHourBucket && (
        <BreakdownDrilldown
          groupLabel={selectedHourBucket.label}
          trades={hourDrilldownTrades}
          currency={currency}
          onClose={closeHourDrilldown}
        />
      )}

      <HoldingTimeChart
        buckets={holdingBuckets}
        currency={currency}
        missingCount={missingHoldingTimeCount}
        selectedKey={selectedHoldingKey}
        onSelectBucket={setSelectedHoldingKey}
      />
      {selectedHoldingBucket && (
        <BreakdownDrilldown
          groupLabel={`Held ${selectedHoldingBucket.label}`}
          trades={holdingDrilldownTrades}
          currency={currency}
          onClose={closeHoldingDrilldown}
        />
      )}

      <ExitReasonByStrategyChart
        rows={exitStrategyRows}
        selectedKey={selectedExitReason ? exitStrategySelectionKey(strategyKey, selectedExitReason) : null}
        onSelectSegment={onSelectExitStrategySegment}
      />
      {selectedExitReason && exitStrategyDrilldownTrades.length > 0 && (
        <BreakdownDrilldown
          groupLabel={`${strategyLabel} · ${selectedExitReasonLabel}`}
          trades={exitStrategyDrilldownTrades}
          currency={currency}
          onClose={closeExitStrategyDrilldown}
        />
      )}

      <SlTrailImpactChart
        rows={slHitRateRows}
        selectedKey={selectedSlMovement ? slMovementSelectionKey(strategyKey, selectedSlMovement) : null}
        onSelectStrategy={onSelectSlMovementSegment}
      />
      {selectedSlMovement && slMovementDrilldownTrades.length > 0 && (
        <BreakdownDrilldown
          groupLabel={`${strategyLabel} · ${selectedSlMovementLabel}`}
          trades={slMovementDrilldownTrades}
          currency={currency}
          onClose={closeSlTrailDrilldown}
        />
      )}
    </div>
  );
}
