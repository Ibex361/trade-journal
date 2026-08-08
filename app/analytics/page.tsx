"use client";

import { useCallback, useDeferredValue, useMemo } from "react";
import { useAccount } from "@/lib/AccountContext";
import { useAnalyticsPageState } from "@/lib/AnalyticsPageStateContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { ExitReason, StopMovement } from "@/lib/trades";
import {
  filterTradesByRange,
  buildEquityCurveForRange,
  getDrawdown,
  getProfitFactor,
  getExpectancy,
  getTotalReturnPct,
  getPnlByPeriod,
  getBreakdownByDimension,
  getTradesInBreakdownGroup,
  getRMultipleDistribution,
  getTradesInRMultipleBucket,
  countMissingRMultiple,
  getPerformanceByHour,
  getTradesInHourBucket,
  countMissingTimeOfDay,
  getPerformanceByHoldingTime,
  getTradesInHoldingTimeBucket,
  countMissingHoldingTime,
  getExitReasonByStrategy,
  getTradesInStrategyExitGroup,
  EXIT_REASON_META,
  getSlHitRateByStrategy,
  getTradesInSlMovementGroup,
  getPlannedVsRealizedR,
  summarizePlannedVsRealizedR,
  countMissingPlannedR,
} from "@/lib/metrics";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import AnalyticsHero from "@/components/analytics/AnalyticsHero";
import PnlByPeriodChart from "@/components/analytics/PnlByPeriodChart";
import TimeOfDayChart from "@/components/analytics/TimeOfDayChart";
import HoldingTimeChart from "@/components/analytics/HoldingTimeChart";
import PerformanceBreakdown from "@/components/analytics/PerformanceBreakdown";
import BreakdownDrilldown from "@/components/analytics/BreakdownDrilldown";
import RMultipleHistogram from "@/components/analytics/RMultipleHistogram";
import RulesFollowedComparison from "@/components/analytics/RulesFollowedComparison";
import ExitReasonByStrategyChart, {
  exitStrategySelectionKey,
} from "@/components/analytics/ExitReasonByStrategyChart";
import SlTrailImpactChart, { slMovementSelectionKey } from "@/components/analytics/SlTrailImpactChart";
import PlannedVsRealizedRChart from "@/components/analytics/PlannedVsRealizedRChart";
import AnalyticsSkeleton from "@/components/analytics/AnalyticsSkeleton";
import Card from "@/components/shared/Card";

export default function AnalyticsPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const { trades, loading } = useTradesData();
  const {
    range,
    setRange,
    granularity,
    setGranularity,
    timeOfDaySource,
    setTimeOfDaySource,
    selectedHourKey,
    setSelectedHourKey,
    selectedHoldingKey,
    setSelectedHoldingKey,
    breakdownDimension,
    setBreakdownDimension,
    selectedGroupKey,
    setSelectedGroupKey,
    selectedRBucketKey,
    setSelectedRBucketKey,
    selectedRulesKey,
    setSelectedRulesKey,
    selectedExitStrategy,
    setSelectedExitStrategy,
    selectedSlMovement,
    setSelectedSlMovement,
    selectedPlannedRId,
    setSelectedPlannedRId,
  } = useAnalyticsPageState();

  // The controls themselves (DateRangeSelector, granularity toggle,
  // breakdown-dimension tabs) read the raw state below so they respond to a
  // tap instantly. Everything downstream — the equity curve, every chart,
  // every derived stat — reads the deferred copies instead, so React can
  // interrupt/deprioritize that (much heavier) recompute rather than
  // blocking the click that triggered it. This is the same pattern already
  // used for the Trades page's filters/sort.
  const deferredRange = useDeferredValue(range);
  const deferredGranularity = useDeferredValue(granularity);
  const deferredTimeOfDaySource = useDeferredValue(timeOfDaySource);
  const deferredBreakdownDimension = useDeferredValue(breakdownDimension);

  const rangeTrades = useMemo(() => filterTradesByRange(trades, deferredRange), [trades, deferredRange]);

  // Keyed on starting_balance, not the account object — same reasoning as
  // the selectedAccount?.id-keyed effects elsewhere (avoids recomputing on
  // AccountContext's spurious object-identity churn from Supabase's
  // background token refresh).
  const equityCurve = useMemo(
    () =>
      selectedAccount
        ? buildEquityCurveForRange(trades, selectedAccount.starting_balance, deferredRange)
        : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trades, selectedAccount?.starting_balance, deferredRange]
  );

  const drawdown = useMemo(() => getDrawdown(equityCurve), [equityCurve]);
  const profitFactor = useMemo(() => getProfitFactor(rangeTrades), [rangeTrades]);
  const expectancy = useMemo(() => getExpectancy(rangeTrades), [rangeTrades]);
  // Same starting_balance-keying reasoning as equityCurve above.
  const totalReturnPct = useMemo(
    () => getTotalReturnPct(rangeTrades, equityCurve[0]?.balance ?? selectedAccount?.starting_balance ?? 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rangeTrades, equityCurve]
  );
  const pnlBuckets = useMemo(
    () => getPnlByPeriod(rangeTrades, deferredGranularity),
    [rangeTrades, deferredGranularity]
  );

  const hourBuckets = useMemo(
    () => getPerformanceByHour(rangeTrades, deferredTimeOfDaySource),
    [rangeTrades, deferredTimeOfDaySource]
  );
  const missingTimeOfDayCount = useMemo(
    () => countMissingTimeOfDay(rangeTrades, deferredTimeOfDaySource),
    [rangeTrades, deferredTimeOfDaySource]
  );
  const hourDrilldownTrades = useMemo(
    () =>
      selectedHourKey ? getTradesInHourBucket(rangeTrades, deferredTimeOfDaySource, selectedHourKey) : [],
    [rangeTrades, deferredTimeOfDaySource, selectedHourKey]
  );
  const selectedHourBucket = useMemo(
    () => hourBuckets.find((b) => b.key === selectedHourKey) ?? null,
    [hourBuckets, selectedHourKey]
  );

  const holdingBuckets = useMemo(() => getPerformanceByHoldingTime(rangeTrades), [rangeTrades]);
  const missingHoldingTimeCount = useMemo(() => countMissingHoldingTime(rangeTrades), [rangeTrades]);
  const holdingDrilldownTrades = useMemo(
    () => (selectedHoldingKey ? getTradesInHoldingTimeBucket(rangeTrades, selectedHoldingKey) : []),
    [rangeTrades, selectedHoldingKey]
  );
  const selectedHoldingBucket = useMemo(
    () => holdingBuckets.find((b) => b.key === selectedHoldingKey) ?? null,
    [holdingBuckets, selectedHoldingKey]
  );

  const breakdownGroups = useMemo(
    () => getBreakdownByDimension(rangeTrades, deferredBreakdownDimension),
    [rangeTrades, deferredBreakdownDimension]
  );

  const selectedGroup = useMemo(
    () => breakdownGroups.find((g) => g.key === selectedGroupKey) ?? null,
    [breakdownGroups, selectedGroupKey]
  );

  const drilldownTrades = useMemo(
    () =>
      selectedGroupKey
        ? getTradesInBreakdownGroup(rangeTrades, deferredBreakdownDimension, selectedGroupKey)
        : [],
    [rangeTrades, deferredBreakdownDimension, selectedGroupKey]
  );

  const rBuckets = useMemo(() => getRMultipleDistribution(rangeTrades), [rangeTrades]);
  const missingRMultipleCount = useMemo(() => countMissingRMultiple(rangeTrades), [rangeTrades]);
  const rDrilldownTrades = useMemo(
    () => (selectedRBucketKey ? getTradesInRMultipleBucket(rangeTrades, selectedRBucketKey) : []),
    [rangeTrades, selectedRBucketKey]
  );
  const selectedRBucket = useMemo(
    () => rBuckets.find((b) => b.key === selectedRBucketKey) ?? null,
    [rBuckets, selectedRBucketKey]
  );

  const rulesGroups = useMemo(() => getBreakdownByDimension(rangeTrades, "rules_followed"), [rangeTrades]);
  const rulesDrilldownTrades = useMemo(
    () => (selectedRulesKey ? getTradesInBreakdownGroup(rangeTrades, "rules_followed", selectedRulesKey) : []),
    [rangeTrades, selectedRulesKey]
  );
  const selectedRulesGroup = useMemo(
    () => rulesGroups.find((g) => g.key === selectedRulesKey) ?? null,
    [rulesGroups, selectedRulesKey]
  );

  const exitStrategyRows = useMemo(() => getExitReasonByStrategy(rangeTrades), [rangeTrades]);
  const exitStrategyDrilldownTrades = useMemo(
    () =>
      selectedExitStrategy
        ? getTradesInStrategyExitGroup(rangeTrades, selectedExitStrategy.strategyKey, selectedExitStrategy.reason)
        : [],
    [rangeTrades, selectedExitStrategy]
  );
  const selectedExitStrategyRow = useMemo(
    () => (selectedExitStrategy ? exitStrategyRows.find((r) => r.key === selectedExitStrategy.strategyKey) : null),
    [exitStrategyRows, selectedExitStrategy]
  );
  const selectedExitStrategyLabel = useMemo(() => {
    if (!selectedExitStrategy || !selectedExitStrategyRow) return "";
    const reasonLabel = EXIT_REASON_META.find((r) => r.value === selectedExitStrategy.reason)?.label ?? "";
    return `${selectedExitStrategyRow.label} · ${reasonLabel}`;
  }, [selectedExitStrategy, selectedExitStrategyRow]);
  const onSelectExitStrategySegment = useCallback((strategyKey: string, reason: ExitReason) => {
    setSelectedExitStrategy((prev) =>
      prev && prev.strategyKey === strategyKey && prev.reason === reason ? null : { strategyKey, reason }
    );
  }, [setSelectedExitStrategy]);

  const slHitRateRows = useMemo(() => getSlHitRateByStrategy(rangeTrades), [rangeTrades]);
  const selectedSlMovementRow = useMemo(
    () => (selectedSlMovement ? slHitRateRows.find((r) => r.key === selectedSlMovement.strategyKey) ?? null : null),
    [slHitRateRows, selectedSlMovement]
  );
  const selectedSlMovementTrades = useMemo(
    () =>
      selectedSlMovement
        ? getTradesInSlMovementGroup(rangeTrades, selectedSlMovement.strategyKey, selectedSlMovement.movement)
        : [],
    [rangeTrades, selectedSlMovement]
  );
  const selectedSlMovementLabel = useMemo(() => {
    if (!selectedSlMovement || !selectedSlMovementRow) return "";
    const movementLabel =
      selectedSlMovement.movement.charAt(0).toUpperCase() + selectedSlMovement.movement.slice(1);
    return `${selectedSlMovementRow.label} · ${movementLabel} SL`;
  }, [selectedSlMovement, selectedSlMovementRow]);
  const onSelectSlMovementSegment = useCallback((strategyKey: string, movement: StopMovement) => {
    setSelectedSlMovement((prev) =>
      prev && prev.strategyKey === strategyKey && prev.movement === movement ? null : { strategyKey, movement }
    );
  }, [setSelectedSlMovement]);
  const closeSlTrailDrilldown = useCallback(() => setSelectedSlMovement(null), [setSelectedSlMovement]);

  const plannedVsRealizedPoints = useMemo(() => getPlannedVsRealizedR(rangeTrades), [rangeTrades]);
  const plannedVsRealizedSummary = useMemo(
    () => summarizePlannedVsRealizedR(plannedVsRealizedPoints),
    [plannedVsRealizedPoints]
  );
  const missingPlannedRCount = useMemo(() => countMissingPlannedR(rangeTrades), [rangeTrades]);
  const selectedPlannedRPoint = useMemo(
    () => (selectedPlannedRId ? plannedVsRealizedPoints.find((p) => p.id === selectedPlannedRId) ?? null : null),
    [plannedVsRealizedPoints, selectedPlannedRId]
  );
  const selectedPlannedRTrade = useMemo(
    () => (selectedPlannedRId ? rangeTrades.find((t) => t.id === selectedPlannedRId) ?? null : null),
    [rangeTrades, selectedPlannedRId]
  );
  const closePlannedRDrilldown = useCallback(() => setSelectedPlannedRId(null), [setSelectedPlannedRId]);

  const closeGroupDrilldown = useCallback(() => setSelectedGroupKey(null), [setSelectedGroupKey]);
  const closeHourDrilldown = useCallback(() => setSelectedHourKey(null), [setSelectedHourKey]);
  const closeHoldingDrilldown = useCallback(() => setSelectedHoldingKey(null), [setSelectedHoldingKey]);
  const closeRBucketDrilldown = useCallback(() => setSelectedRBucketKey(null), [setSelectedRBucketKey]);
  const closeRulesDrilldown = useCallback(() => setSelectedRulesKey(null), [setSelectedRulesKey]);
  const closeExitStrategyDrilldown = useCallback(() => setSelectedExitStrategy(null), [setSelectedExitStrategy]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Analytics</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectedAccount ? `Performance breakdown for ${selectedAccount.name}` : "Your trading performance, broken down."}
          </p>
        </div>
        <DateRangeSelector value={range} onChange={setRange} />
      </div>

      {accountLoading || loading ? (
        <AnalyticsSkeleton />
      ) : !selectedAccount ? (
        <Card padding="none" className="p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </Card>
      ) : (
        <>
          <AnalyticsHero
            totalReturnPct={totalReturnPct}
            profitFactor={profitFactor}
            expectancy={expectancy}
            maxDrawdownPct={drawdown.maxPct}
            currency={selectedAccount.currency}
            points={equityCurve}
          />
          <PnlByPeriodChart
            buckets={pnlBuckets}
            currency={selectedAccount.currency}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
          <TimeOfDayChart
            buckets={hourBuckets}
            currency={selectedAccount.currency}
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
              currency={selectedAccount.currency}
              onClose={closeHourDrilldown}
            />
          )}
          <HoldingTimeChart
            buckets={holdingBuckets}
            currency={selectedAccount.currency}
            missingCount={missingHoldingTimeCount}
            selectedKey={selectedHoldingKey}
            onSelectBucket={setSelectedHoldingKey}
          />
          {selectedHoldingBucket && (
            <BreakdownDrilldown
              groupLabel={`Held ${selectedHoldingBucket.label}`}
              trades={holdingDrilldownTrades}
              currency={selectedAccount.currency}
              onClose={closeHoldingDrilldown}
            />
          )}
          <PerformanceBreakdown
            groups={breakdownGroups}
            currency={selectedAccount.currency}
            dimension={breakdownDimension}
            onDimensionChange={setBreakdownDimension}
            selectedKey={selectedGroupKey}
            onSelectGroup={setSelectedGroupKey}
          />
          {selectedGroup && (
            <BreakdownDrilldown
              groupLabel={selectedGroup.label}
              trades={drilldownTrades}
              currency={selectedAccount.currency}
              onClose={closeGroupDrilldown}
            />
          )}

          {/* R-multiple distribution and rules-followed both read as compact
              comparison panels rather than dense time series, so they share
              a row on wide screens instead of each claiming the full width
              a chart like PnlByPeriodChart actually needs. Each chart's
              drilldown lives inside its own column, directly beneath the
              chart it belongs to — rather than after the row — so clicking
              a bar always shows its trades right under the chart you
              clicked, not under whichever chart happens to render second. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="space-y-4">
              <RMultipleHistogram
                buckets={rBuckets}
                currency={selectedAccount.currency}
                missingCount={missingRMultipleCount}
                selectedKey={selectedRBucketKey}
                onSelectBucket={setSelectedRBucketKey}
              />
              {selectedRBucket && (
                <BreakdownDrilldown
                  groupLabel={selectedRBucket.label}
                  trades={rDrilldownTrades}
                  currency={selectedAccount.currency}
                  onClose={closeRBucketDrilldown}
                />
              )}
            </div>
            <div className="space-y-4">
              <RulesFollowedComparison
                groups={rulesGroups}
                currency={selectedAccount.currency}
                selectedKey={selectedRulesKey}
                onSelectGroup={setSelectedRulesKey}
              />
              {selectedRulesGroup && (
                <BreakdownDrilldown
                  groupLabel={selectedRulesGroup.label}
                  trades={rulesDrilldownTrades}
                  currency={selectedAccount.currency}
                  onClose={closeRulesDrilldown}
                />
              )}
            </div>
          </div>

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
              currency={selectedAccount.currency}
              onClose={closePlannedRDrilldown}
            />
          )}

          <ExitReasonByStrategyChart
            rows={exitStrategyRows}
            selectedKey={
              selectedExitStrategy
                ? exitStrategySelectionKey(selectedExitStrategy.strategyKey, selectedExitStrategy.reason)
                : null
            }
            onSelectSegment={onSelectExitStrategySegment}
          />
          {selectedExitStrategy && (
            <BreakdownDrilldown
              groupLabel={selectedExitStrategyLabel}
              trades={exitStrategyDrilldownTrades}
              currency={selectedAccount.currency}
              onClose={closeExitStrategyDrilldown}
            />
          )}

          <SlTrailImpactChart
            rows={slHitRateRows}
            selectedKey={
              selectedSlMovement ? slMovementSelectionKey(selectedSlMovement.strategyKey, selectedSlMovement.movement) : null
            }
            onSelectStrategy={onSelectSlMovementSegment}
          />
          {selectedSlMovement && selectedSlMovementRow && (
            <BreakdownDrilldown
              groupLabel={selectedSlMovementLabel}
              trades={selectedSlMovementTrades}
              currency={selectedAccount.currency}
              onClose={closeSlTrailDrilldown}
            />
          )}
        </>
      )}
    </div>
  );
}
