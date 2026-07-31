"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade, ExitReason } from "@/lib/trades";
import {
  DateRange,
  PeriodGranularity,
  BreakdownDimension,
  TimeOfDaySource,
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
  getPerformanceByHour,
  getTradesInHourBucket,
  countMissingTimeOfDay,
  getPerformanceByHoldingTime,
  getTradesInHoldingTimeBucket,
  countMissingHoldingTime,
  getExitReasonByStrategy,
  getTradesInStrategyExitGroup,
  EXIT_REASON_META,
  getSlTrailImpactByStrategy,
  getTradesInSlTrailGroup,
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
import SlTrailImpactChart from "@/components/analytics/SlTrailImpactChart";
import PlannedVsRealizedRChart from "@/components/analytics/PlannedVsRealizedRChart";
import AnalyticsSkeleton from "@/components/analytics/AnalyticsSkeleton";
import Card from "@/components/shared/Card";

export default function AnalyticsPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("30d");
  const [granularity, setGranularity] = useState<PeriodGranularity>("day");
  const [timeOfDaySource, setTimeOfDaySource] = useState<TimeOfDaySource>("entry");
  const [selectedHourKey, setSelectedHourKey] = useState<string | null>(null);
  const [selectedHoldingKey, setSelectedHoldingKey] = useState<string | null>(null);
  const [breakdownDimension, setBreakdownDimension] = useState<BreakdownDimension>("instrument");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedRBucketKey, setSelectedRBucketKey] = useState<string | null>(null);
  const [selectedRulesKey, setSelectedRulesKey] = useState<string | null>(null);
  const [selectedExitStrategy, setSelectedExitStrategy] = useState<{ strategyKey: string; reason: ExitReason } | null>(
    null
  );
  const [selectedSlTrailKey, setSelectedSlTrailKey] = useState<string | null>(null);
  const [selectedPlannedRId, setSelectedPlannedRId] = useState<string | null>(null);

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

  useEffect(() => {
    async function load() {
      if (!selectedAccount) return;
      setLoading(true);
      const { data } = await fetchTrades(selectedAccount.id);
      if (data) setTrades(data as Trade[]);
      setLoading(false);
    }
    load();
  }, [selectedAccount?.id]);

  const rangeTrades = useMemo(() => filterTradesByRange(trades, deferredRange), [trades, deferredRange]);

  const equityCurve = useMemo(
    () =>
      selectedAccount
        ? buildEquityCurveForRange(trades, selectedAccount.starting_balance, deferredRange)
        : [],
    [trades, selectedAccount?.starting_balance, deferredRange]
  );

  const drawdown = useMemo(() => getDrawdown(equityCurve), [equityCurve]);
  const profitFactor = useMemo(() => getProfitFactor(rangeTrades), [rangeTrades]);
  const expectancy = useMemo(() => getExpectancy(rangeTrades), [rangeTrades]);
  const totalReturnPct = useMemo(
    () => getTotalReturnPct(rangeTrades, equityCurve[0]?.balance ?? selectedAccount?.starting_balance ?? 0),
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

  // Clear the hour drilldown whenever the underlying trade set changes shape
  // (range or time source), so a stale key never lingers on screen.
  useEffect(() => {
    setSelectedHourKey(null);
  }, [deferredRange, deferredTimeOfDaySource]);

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

  // Clear the holding-time drilldown whenever the range changes, so a stale
  // key never lingers on screen.
  useEffect(() => {
    setSelectedHoldingKey(null);
  }, [deferredRange]);

  const breakdownGroups = useMemo(
    () => getBreakdownByDimension(rangeTrades, deferredBreakdownDimension),
    [rangeTrades, deferredBreakdownDimension]
  );

  // Clear the drill-down selection whenever the underlying trade set changes
  // shape (range or dimension), so a stale key never lingers on screen.
  useEffect(() => {
    setSelectedGroupKey(null);
  }, [deferredRange, deferredBreakdownDimension]);

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
  }, []);

  const slTrailRows = useMemo(() => getSlTrailImpactByStrategy(rangeTrades), [rangeTrades]);
  const selectedSlTrailRow = useMemo(
    () => (selectedSlTrailKey ? slTrailRows.find((r) => r.key === selectedSlTrailKey) ?? null : null),
    [slTrailRows, selectedSlTrailKey]
  );
  const slTrailTrailedTrades = useMemo(
    () => (selectedSlTrailKey ? getTradesInSlTrailGroup(rangeTrades, selectedSlTrailKey, true) : []),
    [rangeTrades, selectedSlTrailKey]
  );
  const slTrailHeldTrades = useMemo(
    () => (selectedSlTrailKey ? getTradesInSlTrailGroup(rangeTrades, selectedSlTrailKey, false) : []),
    [rangeTrades, selectedSlTrailKey]
  );
  const closeSlTrailDrilldown = useCallback(() => setSelectedSlTrailKey(null), []);

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
  const closePlannedRDrilldown = useCallback(() => setSelectedPlannedRId(null), []);

  // Clear every drill-down selection whenever the date range changes, so a
  // stale key never lingers on screen.
  useEffect(() => {
    setSelectedRBucketKey(null);
    setSelectedRulesKey(null);
    setSelectedExitStrategy(null);
    setSelectedSlTrailKey(null);
    setSelectedPlannedRId(null);
  }, [deferredRange]);

  const closeGroupDrilldown = useCallback(() => setSelectedGroupKey(null), []);
  const closeHourDrilldown = useCallback(() => setSelectedHourKey(null), []);
  const closeHoldingDrilldown = useCallback(() => setSelectedHoldingKey(null), []);
  const closeRBucketDrilldown = useCallback(() => setSelectedRBucketKey(null), []);
  const closeRulesDrilldown = useCallback(() => setSelectedRulesKey(null), []);
  const closeExitStrategyDrilldown = useCallback(() => setSelectedExitStrategy(null), []);

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
            rows={slTrailRows}
            selectedKey={selectedSlTrailKey}
            onSelectStrategy={setSelectedSlTrailKey}
          />
          {selectedSlTrailRow && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <BreakdownDrilldown
                groupLabel={`${selectedSlTrailRow.label} · Trailed SL`}
                trades={slTrailTrailedTrades}
                currency={selectedAccount.currency}
                onClose={closeSlTrailDrilldown}
              />
              <BreakdownDrilldown
                groupLabel={`${selectedSlTrailRow.label} · Held SL`}
                trades={slTrailHeldTrades}
                currency={selectedAccount.currency}
                onClose={closeSlTrailDrilldown}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
