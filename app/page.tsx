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
import { useWinRateMode, WIN_RATE_MODE_LABELS } from "@/lib/WinRateModeContext";
import DashboardHero from "@/components/dashboard/DashboardHero";
import StatChipRow from "@/components/dashboard/StatChipRow";
import RecentTradesFeed from "@/components/dashboard/RecentTradesFeed";
import TargetProgress from "@/components/dashboard/TargetProgress";
import Card from "@/components/shared/Card";

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

  const winRate = pickWinRate(summary, winRateMode);

  // Mirrors the flag TargetProgress uses internally to decide whether to
  // badge itself — duplicated here (cheap booleans, not worth a callback)
  // so the grid can give it more room when there's something to look at,
  // instead of two fixed-width cards regardless of what's in them.
  const riskBreached =
    selectedAccount?.target_risk_pct != null && avgRiskPct != null && avgRiskPct > selectedAccount.target_risk_pct;
  const drawdownDeep = drawdown.maxAmount > 0 && drawdown.currentAmount / drawdown.maxAmount > 0.6;
  const targetsNeedAttention = riskBreached || drawdownDeep;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Dashboard</h1>
        <p className="text-ink-secondary text-sm mt-1">
          {selectedAccount ? `Overview for ${selectedAccount.name}` : "Your trading at a glance."}
        </p>
      </div>

      {accountLoading || loading ? (
        <Card padding="none" className="p-10 text-center">
          <p className="text-ink-muted text-sm">Loading dashboard…</p>
        </Card>
      ) : !selectedAccount ? (
        <Card padding="none" className="p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </Card>
      ) : (
        <>
          <DashboardHero
            accountBalance={accountBalance}
            totalPnl={summary.totalPnl}
            currency={selectedAccount.currency}
            points={equityCurve}
            streak={streak}
          />
          <StatChipRow
            winRate={winRate}
            winRateHint={WIN_RATE_MODE_LABELS[winRateMode]}
            avgR={summary.avgR}
            tradesCount={summary.count}
          />

          <div className={`grid grid-cols-1 gap-4 ${targetsNeedAttention ? "lg:grid-cols-5" : "lg:grid-cols-2"}`}>
            <div className={targetsNeedAttention ? "lg:col-span-3" : ""}>
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
            </div>
            <div className={targetsNeedAttention ? "lg:col-span-2" : ""}>
              <RecentTradesFeed trades={trades} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
