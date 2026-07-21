"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade } from "@/lib/trades";
import {
  DateRange,
  PeriodGranularity,
  filterTradesByRange,
  buildEquityCurveForRange,
  getDrawdown,
  getProfitFactor,
  getExpectancy,
  getTotalReturnPct,
  getPnlByPeriod,
} from "@/lib/metrics";
import DateRangeSelector from "@/components/analytics/DateRangeSelector";
import AnalyticsStats from "@/components/analytics/AnalyticsStats";
import PnlByPeriodChart from "@/components/analytics/PnlByPeriodChart";
import EquityCurveChart from "@/components/dashboard/EquityCurveChart";

export default function AnalyticsPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<DateRange>("30d");
  const [granularity, setGranularity] = useState<PeriodGranularity>("day");

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
    () => (selectedAccount ? getTotalReturnPct(rangeTrades, selectedAccount.starting_balance) : null),
    [rangeTrades, selectedAccount?.starting_balance]
  );
  const pnlBuckets = useMemo(
    () => getPnlByPeriod(rangeTrades, granularity),
    [rangeTrades, granularity]
  );

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
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">Loading analytics…</p>
        </div>
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <>
          <AnalyticsStats
            totalReturnPct={totalReturnPct}
            profitFactor={profitFactor}
            expectancy={expectancy}
            maxDrawdownPct={drawdown.maxPct}
            currency={selectedAccount.currency}
          />
          <EquityCurveChart points={equityCurve} currency={selectedAccount.currency} />
          <PnlByPeriodChart
            buckets={pnlBuckets}
            currency={selectedAccount.currency}
            granularity={granularity}
            onGranularityChange={setGranularity}
          />
        </>
      )}
    </div>
  );
}
