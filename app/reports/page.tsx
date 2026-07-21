"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade } from "@/lib/trades";
import { getTradesInMonth, getDailyPnlForMonth, getBestWorstDay, summarizeTrades } from "@/lib/metrics";
import MonthSelector from "@/components/reports/MonthSelector";
import CalendarHeatmap from "@/components/reports/CalendarHeatmap";
import ReportsSummaryStats from "@/components/reports/ReportsSummaryStats";

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

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Reports</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectedAccount ? `Monthly report for ${selectedAccount.name}` : "Your monthly trading report."}
          </p>
        </div>
        <MonthSelector year={year} month={month} onChange={(y, m) => { setYear(y); setMonth(m); }} />
      </div>

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
        </>
      )}
    </div>
  );
}
