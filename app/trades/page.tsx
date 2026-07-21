"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, deleteTrade, Trade } from "@/lib/trades";
import TradesList from "@/components/trades/TradesList";
import TradeFormPanel from "@/components/trades/TradeFormPanel";

export default function TradesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const { data } = await fetchTrades(selectedAccount.id);
    if (data) setTrades(data as Trade[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  function openNew() {
    setEditingTrade(null);
    setPanelOpen(true);
  }

  function openEdit(trade: Trade) {
    setEditingTrade(trade);
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditingTrade(null);
  }

  async function handleSaved() {
    closePanel();
    await load();
  }

  async function handleDelete(id: string) {
    await deleteTrade(id);
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Trades</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectedAccount
              ? `${trades.length} trade${trades.length === 1 ? "" : "s"} logged for ${selectedAccount.name}`
              : "Log and manage every trade."}
          </p>
        </div>
        <button
          onClick={openNew}
          disabled={!selectedAccount}
          className="shrink-0 text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full disabled:opacity-50"
        >
          New trade
        </button>
      </div>

      {accountLoading || loading ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">Loading trades…</p>
        </div>
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <TradesList trades={trades} onEdit={openEdit} onDelete={handleDelete} />
      )}

      {panelOpen && (
        <TradeFormPanel trade={editingTrade} onClose={closePanel} onSaved={handleSaved} />
      )}
    </div>
  );
}
