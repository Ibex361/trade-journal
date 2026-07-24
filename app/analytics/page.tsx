"use client";

import { useEffect, useMemo, useState } from "react";
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

  const rangeTrades = useMemo(() => filterTradesByRange(trades, range), [trades, range]);

  const equityCurve = useMemo(
    () =>
      selectedAccount ? buildEquityCurveForRange(trades, selectedAccount.starting_balance, range) : [],
    [trades, selectedAccount?.starting_balance, range]
  );

  const drawdown = useMemo(() => getDrawdown(equityCurve), [equityCurve]);
  const profitFactor = useMemo(() => getProfitFactor(rangeTrades), [rangeTrades]);
  const expectancy = useMemo(() => getExpectancy(rangeTrades), [rangeTrades]);
  const totalReturnPct = useMemo(
    () => getTotalReturnPct(rangeTrades, equityCurve[0]?.balance ?? selectedAccount?.starting_balance ?? 0),
    [rangeTrades, equityCurve]
  );
  const pnlBuckets = useMemo(
    () => getPnlByPeriod(rangeTrades, granularity),
    [rangeTrades, granularity]
  );

  const breakdownGroups = useMemo(
    () => getBreakdownByDimension(rangeTrades, breakdownDimension),
    [rangeTrades, breakdownDimension]
  );

  // Clear the drill-down selection whenever the underlying trade set changes
  // shape (range or dimension), so a stale key never lingers on screen.
  useEffect(() => {
    setSelectedGroupKey(null);
  }, [range, breakdownDimension]);

  const selectedGroup = useMemo(
    () => breakdownGroups.find((g) => g.key === selectedGroupKey) ?? null,
    [breakdownGroups, selectedGroupKey]
  );

  const drilldownTrades = useMemo(
    () =>
      selectedGroupKey ? getTradesInBreakdownGroup(rangeTrades, breakdownDimension, selectedGroupKey) : [],
    [rangeTrades, breakdownDimension, selectedGroupKey]
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
  }, [range]);

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
        <Card padding="none" className="p-10 text-center">
          <p className="text-ink-muted text-sm">Loading analytics…</p>
        </Card>
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
              onClose={() => setSelectedGroupKey(null)}
            />
          )}

          {/* R-multiple distribution and rules-followed both read as compact
              comparison panels rather than dense time series, so they share
              a row on wide screens instead of each claiming the full width
              a chart like PnlByPeriodChart actually needs. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RMultipleHistogram
              buckets={rBuckets}
              currency={selectedAccount.currency}
              selectedKey={selectedRBucketKey}
              onSelectBucket={setSelectedRBucketKey}
            />
            <RulesFollowedComparison
              groups={rulesGroups}
              currency={selectedAccount.currency}
              selectedKey={selectedRulesKey}
              onSelectGroup={setSelectedRulesKey}
            />
          </div>
          {selectedRBucket && (
            <BreakdownDrilldown
              groupLabel={selectedRBucket.label}
              trades={rDrilldownTrades}
              currency={selectedAccount.currency}
              onClose={() => setSelectedRBucketKey(null)}
            />
          )}
          {selectedRulesGroup && (
            <BreakdownDrilldown
              groupLabel={selectedRulesGroup.label}
              trades={rulesDrilldownTrades}
              currency={selectedAccount.currency}
              onClose={() => setSelectedRulesKey(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
