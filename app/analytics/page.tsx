"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade } from "@/lib/trades";
import {
  DateRange,
  PeriodGranularity,
  BreakdownDimension,
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
} from "@/lib/metrics";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import AnalyticsHero from "@/components/analytics/AnalyticsHero";
import PnlByPeriodChart from "@/components/analytics/PnlByPeriodChart";
import PerformanceBreakdown from "@/components/analytics/PerformanceBreakdown";
import BreakdownDrilldown from "@/components/analytics/BreakdownDrilldown";
import RMultipleHistogram from "@/components/analytics/RMultipleHistogram";
import RulesFollowedComparison from "@/components/analytics/RulesFollowedComparison";
import AnalyticsSkeleton from "@/components/analytics/AnalyticsSkeleton";
import Card from "@/components/shared/Card";

export default function AnalyticsPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("30d");
  const [granularity, setGranularity] = useState<PeriodGranularity>("day");
  const [breakdownDimension, setBreakdownDimension] = useState<BreakdownDimension>("instrument");
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null);
  const [selectedRBucketKey, setSelectedRBucketKey] = useState<string | null>(null);
  const [selectedRulesKey, setSelectedRulesKey] = useState<string | null>(null);

  // The controls themselves (DateRangeSelector, granularity toggle,
  // breakdown-dimension tabs) read the raw state below so they respond to a
  // tap instantly. Everything downstream — the equity curve, every chart,
  // every derived stat — reads the deferred copies instead, so React can
  // interrupt/deprioritize that (much heavier) recompute rather than
  // blocking the click that triggered it. This is the same pattern already
  // used for the Trades page's filters/sort.
  const deferredRange = useDeferredValue(range);
  const deferredGranularity = useDeferredValue(granularity);
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

  // Clear every drill-down selection whenever the date range changes, so a
  // stale key never lingers on screen.
  useEffect(() => {
    setSelectedRBucketKey(null);
    setSelectedRulesKey(null);
  }, [deferredRange]);

  const closeGroupDrilldown = useCallback(() => setSelectedGroupKey(null), []);
  const closeRBucketDrilldown = useCallback(() => setSelectedRBucketKey(null), []);
  const closeRulesDrilldown = useCallback(() => setSelectedRulesKey(null), []);

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
        </>
      )}
    </div>
  );
}
