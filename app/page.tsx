"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade } from "@/lib/trades";
import {
  summarizeTrades,
  buildEquityCurve,
  getCurrentStreak,
  getDrawdown,
  getTradesInCurrentMonth,
  getAvgRiskPct,
  getBalanceBeforeTrade,
  pickWinRate,
} from "@/lib/metrics";
import { useWinRateMode } from "@/lib/WinRateModeContext";
import DashboardStats from "@/components/dashboard/DashboardStats";
import EquityCurveChart from "@/components/dashboard/EquityCurveChart";
import RecentTradesFeed from "@/components/dashboard/RecentTradesFeed";
import TargetProgress from "@/components/dashboard/TargetProgress";

export default function DashboardPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const { mode: winRateMode } = useWinRateMode();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

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

  const summary = useMemo(() => summarizeTrades(trades), [trades]);

  const equityCurve = useMemo(
    () => (selectedAccount ? buildEquityCurve(trades, selectedAccount.starting_balance) : []),
    [trades, selectedAccount?.starting_balance]
  );

  const accountBalance = (selectedAccount?.starting_balance ?? 0) + summary.totalPnl;

  const streak = useMemo(() => getCurrentStreak(trades), [trades]);
  const drawdown = useMemo(() => getDrawdown(equityCurve), [equityCurve]);

  const monthTrades = useMemo(() => getTradesInCurrentMonth(trades), [trades]);
  const monthSummary = useMemo(() => summarizeTrades(monthTrades), [monthTrades]);
  // Each trade's risk % is measured against the balance it actually had at
  // the time, not today's balance — see getAvgRiskPct / getBalanceBeforeTrade.
  const balanceBeforeByTradeId = useMemo(
    () => (selectedAccount ? getBalanceBeforeTrade(trades, selectedAccount.starting_balance) : new Map<string, number>()),
    [trades, selectedAccount?.starting_balance]
  );
  const avgRiskPct = useMemo(
    () => getAvgRiskPct(monthTrades, balanceBeforeByTradeId),
    [monthTrades, balanceBeforeByTradeId]
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-ink-secondary text-sm mt-1">
          {selectedAccount ? `Overview for ${selectedAccount.name}` : "Your trading at a glance."}
        </p>
      </div>

      {accountLoading || loading ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">Loading dashboard…</p>
        </div>
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <>
          <DashboardStats
            summary={summary}
            currency={selectedAccount.currency}
            accountBalance={accountBalance}
            streak={streak}
          />
          <EquityCurveChart points={equityCurve} currency={selectedAccount.currency} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <TargetProgress
              targetMonthlyPnl={selectedAccount.target_monthly_pnl}
              targetMonthlyWinrate={selectedAccount.target_monthly_winrate}
              targetRiskPct={selectedAccount.target_risk_pct}
              monthlyPnl={monthSummary.totalPnl}
              monthlyWinRate={pickWinRate(monthSummary, winRateMode)}
              avgRiskPct={avgRiskPct}
              currency={selectedAccount.currency}
              drawdown={drawdown}
            />
            <RecentTradesFeed trades={trades} />
          </div>
        </>
      )}
    </div>
  );
}
