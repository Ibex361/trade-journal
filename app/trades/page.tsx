"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, deleteTrade, Trade } from "@/lib/trades";
import { fetchDropdownItems, DropdownItem } from "@/lib/dropdownSettings";
import { deleteScreenshotByUrl } from "@/lib/screenshots";
import { summarizeTrades } from "@/lib/metrics";
import TradesList, { SortState } from "@/components/trades/TradesList";
import TradeFormPanel from "@/components/trades/TradeFormPanel";
import TradesFilterBar, { TradeFilters, EMPTY_FILTERS } from "@/components/trades/TradesFilterBar";
import TradesSummaryStrip from "@/components/trades/TradesSummaryStrip";

function applyFilters(trades: Trade[], filters: TradeFilters): Trade[] {
  const search = filters.search.trim().toLowerCase();
  return trades.filter((t) => {
    if (search && !t.instrument.toLowerCase().includes(search)) return false;
    if (filters.assetClass && t.asset_class !== filters.assetClass) return false;
    if (filters.strategy && t.strategy !== filters.strategy) return false;
    if (filters.session && t.session !== filters.session) return false;
    if (filters.direction && t.direction !== filters.direction) return false;
    if (filters.rulesFollowed === "yes" && t.rules_followed !== true) return false;
    if (filters.rulesFollowed === "no" && t.rules_followed !== false) return false;
    if (filters.pnlOutcome === "win" && !(t.pnl > 0)) return false;
    if (filters.pnlOutcome === "loss" && !(t.pnl < 0)) return false;
    if (filters.pnlOutcome === "breakeven" && t.pnl !== 0) return false;
    if (filters.pnlMin !== "" && t.pnl < parseFloat(filters.pnlMin)) return false;
    if (filters.pnlMax !== "" && t.pnl > parseFloat(filters.pnlMax)) return false;
    if (filters.dateFrom && t.entry_date < filters.dateFrom) return false;
    if (filters.dateTo && t.entry_date > filters.dateTo) return false;
    return true;
  });
}

function applySort(trades: Trade[], sort: SortState): Trade[] {
  const sorted = [...trades].sort((a, b) => {
    let cmp = 0;
    switch (sort.column) {
      case "entry_date":
        cmp = a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at);
        break;
      case "instrument":
        cmp = a.instrument.localeCompare(b.instrument);
        break;
      case "pnl":
        cmp = a.pnl - b.pnl;
        break;
      case "r_multiple":
        cmp = (a.r_multiple ?? -Infinity) - (b.r_multiple ?? -Infinity);
        break;
    }
    return sort.direction === "asc" ? cmp : -cmp;
  });
  return sorted;
}

export default function TradesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [filters, setFilters] = useState<TradeFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortState>({ column: "entry_date", direction: "desc" });
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const [{ data: tradesData }, { data: dropdownData }] = await Promise.all([
      fetchTrades(selectedAccount.id),
      fetchDropdownItems(selectedAccount.id),
    ]);
    if (tradesData) setTrades(tradesData as Trade[]);
    if (dropdownData) setDropdowns(dropdownData as DropdownItem[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    setFilters(EMPTY_FILTERS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  const visibleTrades = useMemo(
    () => applySort(applyFilters(trades, filters), sort),
    [trades, filters, sort]
  );

  const summary = useMemo(() => summarizeTrades(visibleTrades), [visibleTrades]);

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
    const trade = trades.find((t) => t.id === id);
    setDeleteError(null);
    const { error } = await deleteTrade(id);
    if (error) {
      setDeleteError("Couldn't delete this trade. Please try again.");
      return;
    }
    if (trade?.screenshot_url) {
      deleteScreenshotByUrl(trade.screenshot_url).catch(() => {});
    }
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
        <>
          <TradesSummaryStrip summary={summary} currency={selectedAccount.currency} />
          <TradesFilterBar filters={filters} onChange={setFilters} dropdowns={dropdowns} />
          {deleteError && (
            <div className="rounded-md border border-loss/30 bg-loss/10 px-4 py-3 flex items-center justify-between gap-4">
              <p className="text-xs text-loss">{deleteError}</p>
              <button
                onClick={() => setDeleteError(null)}
                className="text-xs text-ink-muted hover:text-ink-primary shrink-0"
              >
                Dismiss
              </button>
            </div>
          )}
          <TradesList
            trades={visibleTrades}
            onEdit={openEdit}
            onDelete={handleDelete}
            sort={sort}
            onSortChange={setSort}
          />
        </>
      )}

      {panelOpen && (
        <TradeFormPanel trade={editingTrade} onClose={closePanel} onSaved={handleSaved} />
      )}
    </div>
  );
}
