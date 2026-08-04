"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { getStrategyLeaderboard, getStrategyAssetDirectionBreakdown } from "@/lib/metrics";
import StrategyLeaderboard from "@/components/strategies/StrategyLeaderboard";
import StrategyAssetBreakdown from "@/components/strategies/StrategyAssetBreakdown";
import StrategiesSkeleton from "@/components/strategies/StrategiesSkeleton";

export default function StrategiesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const { trades, loading } = useTradesData();
  const [selectedStrategyKey, setSelectedStrategyKey] = useState<string | null>(null);

  const rows = useMemo(() => getStrategyLeaderboard(trades), [trades]);

  const selectedRow = useMemo(
    () => (selectedStrategyKey == null ? null : rows.find((r) => r.key === selectedStrategyKey) ?? null),
    [rows, selectedStrategyKey]
  );

  const breakdownRows = useMemo(
    () => (selectedStrategyKey == null ? [] : getStrategyAssetDirectionBreakdown(trades, selectedStrategyKey)),
    [trades, selectedStrategyKey]
  );

  // A strategy selected against one account's trades shouldn't carry over
  // to another account after a switch.
  useEffect(() => {
    setSelectedStrategyKey(null);
  }, [selectedAccount?.id]);

  function handleSelectRow(key: string) {
    setSelectedStrategyKey((current) => (current === key ? null : key));
  }

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
        <>
          <StrategyLeaderboard
            rows={rows}
            currency={selectedAccount.currency}
            selectedKey={selectedStrategyKey}
            onSelectRow={handleSelectRow}
          />
          {selectedRow && (
            <StrategyAssetBreakdown
              strategyLabel={selectedRow.label}
              rows={breakdownRows}
              currency={selectedAccount.currency}
              onClose={() => setSelectedStrategyKey(null)}
            />
          )}
        </>
      )}
    </div>
  );
}
