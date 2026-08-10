"use client";

import { useCallback, useDeferredValue, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { getTradesInMonth, getDailyPnlForMonth, getBestWorstDay, getBestWorstTrade, getTagFrequency, summarizeTrades } from "@/lib/metrics";
import MonthSelector from "@/components/reports/MonthSelector";
import CalendarHeatmap from "@/components/reports/CalendarHeatmap";
import ReportsHero from "@/components/reports/ReportsHero";
import MonthlyTradesTable from "@/components/reports/MonthlyTradesTable";
import ReportsToolbar from "@/components/reports/ReportsToolbar";
import TradeSpotlight from "@/components/reports/TradeSpotlight";
import TagFrequency from "@/components/reports/TagFrequency";
import ReportsSkeleton from "@/components/reports/ReportsSkeleton";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const { trades, loading } = useTradesData();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  // Same pattern as Trades/Analytics: MonthSelector reads the raw state so
  // it switches instantly, everything else reads the deferred copy.
  const deferredYear = useDeferredValue(year);
  const deferredMonth = useDeferredValue(month);
  const handleMonthChange = useCallback((y: number, m: number) => {
    setYear(y);
    setMonth(m);
  }, [setYear, setMonth]);

  const monthTrades = useMemo(
    () => getTradesInMonth(trades, deferredYear, deferredMonth),
    [trades, deferredYear, deferredMonth]
  );
  // Derived from monthTrades (already filtered) rather than re-scanning the
  // full account history a second time — see getDailyPnlForMonth's
  // docstring. Together with getTradesInMonth switching to a string-prefix
  // match instead of per-trade Date parsing, a month switch now does one
  // full-history pass instead of two, with no Date allocation in either.
  const dailyPnls = useMemo(
    () => getDailyPnlForMonth(monthTrades, deferredYear, deferredMonth),
    [monthTrades, deferredYear, deferredMonth]
  );
  const summary = useMemo(() => summarizeTrades(monthTrades), [monthTrades]);
  const { best, worst } = useMemo(() => getBestWorstDay(dailyPnls), [dailyPnls]);
  const { best: bestTrade, worst: worstTrade } = useMemo(() => getBestWorstTrade(monthTrades), [monthTrades]);
  const tagFrequency = useMemo(() => getTagFrequency(monthTrades), [monthTrades]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3 print:hidden">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Reports</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectedAccount ? `Monthly report for ${selectedAccount.name}` : "Your monthly trading report."}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <MonthSelector year={year} month={month} onChange={handleMonthChange} />
          {selectedAccount && <ReportsToolbar trades={monthTrades} accountName={selectedAccount.name} year={deferredYear} month={deferredMonth} />}
        </div>
      </div>

      {/* Print-only header — the on-screen header above is hidden for print,
          this stands in as the report's title block on paper/PDF. */}
      {selectedAccount && (
        <div className="hidden print:block mb-2">
          <h1 className="font-display text-2xl font-medium tracking-tight">{selectedAccount.name} — Trading Report</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {MONTH_LABELS[month - 1]} {year} · Generated {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
          </p>
        </div>
      )}

      {accountLoading || loading ? (
        <ReportsSkeleton />
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <>
          <ReportsHero summary={summary} dailyPnls={dailyPnls} currency={selectedAccount.currency} />
          <CalendarHeatmap
            year={deferredYear}
            month={deferredMonth}
            days={dailyPnls}
            currency={selectedAccount.currency}
            bestDate={best?.date}
            worstDate={worst?.date}
          />
          <TradeSpotlight best={bestTrade} worst={worstTrade} />
          <TagFrequency tags={tagFrequency} />
          <div>
            <h2 className="font-display text-base font-medium mb-3 print:mt-4">Trades this month</h2>
            <MonthlyTradesTable trades={monthTrades} />
          </div>
        </>
      )}
    </div>
  );
}
