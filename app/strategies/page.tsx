"use client";

import { useMemo } from "react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { useStrategiesPageState } from "@/lib/StrategiesPageStateContext";
import { getStrategyLeaderboard, getStrategyAssetDirectionBreakdown } from "@/lib/metrics";
import StrategyLeaderboard from "@/components/strategies/StrategyLeaderboard";
import StrategyAssetBreakdown from "@/components/strategies/StrategyAssetBreakdown";
import StrategyChartsPanel from "@/components/strategies/StrategyChartsPanel";
import StrategiesSkeleton from "@/components/strategies/StrategiesSkeleton";

export default function StrategiesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const { trades, loading } = useTradesData();
  const { selectedStrategyKey, setSelectedStrategyKey } = useStrategiesPageState();

  const rows = useMemo(() => getStrategyLeaderboard(trades), [trades]);

  const selectedRow = useMemo(
    () => (selectedStrategyKey == null ? null : rows.find((r) => r.key === selectedStrategyKey) ?? null),
    [rows, selectedStrategyKey]
  );

  const breakdownRows = useMemo(
    () => (selectedStrategyKey == null ? [] : getStrategyAssetDirectionBreakdown(trades, selectedStrategyKey)),
    [trades, selectedStrategyKey]
  );

  // Phase 3: same trades, filtered down to the selected strategy, feeds
  // StrategyChartsPanel — which reuses the existing Analytics charts as-is
  // against this narrower set.
  const strategyTrades = useMemo(
    () =>
      selectedStrategyKey == null
        ? []
        : trades.filter((t) => (t.strategy ?? "unspecified") === selectedStrategyKey),
    [trades, selectedStrategyKey]
  );

  // Resetting selection on account switch (vs. a bare remount from
  // navigating back to this page) is handled inside StrategiesPageState,
  // the same way TradesPageState/AnalyticsPageState do it — see the comment
  // there for why that logic has to live in the never-unmounting provider.

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
          {selectedRow && (
            <StrategyChartsPanel
              strategyKey={selectedRow.key}
              strategyLabel={selectedRow.label}
              trades={strategyTrades}
              currency={selectedAccount.currency}
            />
          )}
        </>
      )}
    </div>
  );
}
