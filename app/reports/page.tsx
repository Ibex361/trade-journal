"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade } from "@/lib/trades";
import { getTradesInMonth, getDailyPnlForMonth, getBestWorstDay, getBestWorstTrade, getTagFrequency, summarizeTrades } from "@/lib/metrics";
import MonthSelector from "@/components/reports/MonthSelector";
import CalendarHeatmap from "@/components/reports/CalendarHeatmap";
import ReportsSummaryStats from "@/components/reports/ReportsSummaryStats";
import MonthlyTradesTable from "@/components/reports/MonthlyTradesTable";
import ReportsToolbar from "@/components/reports/ReportsToolbar";
import TradeSpotlight from "@/components/reports/TradeSpotlight";
import TagFrequency from "@/components/reports/TagFrequency";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ReportsPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);

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

  const monthTrades = useMemo(() => getTradesInMonth(trades, year, month), [trades, year, month]);
  const dailyPnls = useMemo(() => getDailyPnlForMonth(trades, year, month), [trades, year, month]);
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
          <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
          {selectedAccount && <ReportsToolbar trades={monthTrades} accountName={selectedAccount.name} year={year} month={month} />}
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
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">Loading report…</p>
        </div>
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <>
          <ReportsSummaryStats
            summary={summary}
            bestDay={best}
            worstDay={worst}
            currency={selectedAccount.currency}
          />
          <CalendarHeatmap year={year} month={month} days={dailyPnls} currency={selectedAccount.currency} />
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
