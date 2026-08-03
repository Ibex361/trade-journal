"use client";

import { useMemo } from "react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { getStrategyLeaderboard } from "@/lib/metrics";
import StrategyLeaderboard from "@/components/strategies/StrategyLeaderboard";
import StrategiesSkeleton from "@/components/strategies/StrategiesSkeleton";

export default function StrategiesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const { trades, loading } = useTradesData();

  const rows = useMemo(() => getStrategyLeaderboard(trades), [trades]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Strategies</h1>
        <p className="text-ink-secondary text-sm mt-1">
          {selectedAccount ? `Strategy performance for ${selectedAccount.name}` : "Which of your systems actually have an edge."}
        </p>
      </div>

      {accountLoading || loading ? (
        <StrategiesSkeleton />
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <StrategyLeaderboard rows={rows} currency={selectedAccount.currency} />
      )}
    </div>
  );
}
