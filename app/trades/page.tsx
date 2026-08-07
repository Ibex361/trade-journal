"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAccount } from "@/lib/AccountContext";
import { useTradesPageState } from "@/lib/TradesPageStateContext";
import { useNotesPageState } from "@/lib/NotesPageStateContext";
import { deleteTrade, deleteTrades, updateTradeTags, updateTradeRules, Trade } from "@/lib/trades";
import { useTradesData } from "@/lib/TradesDataContext";
import { fetchDropdownItems, DropdownItem } from "@/lib/dropdownSettings";
import { fetchDistinctTags, TagSettingItem } from "@/lib/tagSettings";
import { deleteScreenshot } from "@/lib/screenshots";
import { summarizeTrades } from "@/lib/metrics";
import { tradesToCsv, downloadCsv, slugify } from "@/lib/csvExport";
import { createNote, findNoteLinkedToTrade } from "@/lib/notes";
import TradesList, { SortState } from "@/components/trades/TradesList";
import TradeFormPanel from "@/components/trades/TradeFormPanel";
import TradesFilterBar, { TradeFilters } from "@/components/trades/TradesFilterBar";
import TradesPerformanceRibbon from "@/components/trades/TradesPerformanceRibbon";
import TradesSkeleton from "@/components/trades/TradesSkeleton";
import BulkActionsBar from "@/components/trades/BulkActionsBar";

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
    if (filters.tag && !(t.tags ?? []).includes(filters.tag)) return false;
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
  const { trades, loading: tradesLoading, refreshTrades } = useTradesData();
  const router = useRouter();
  const { setActiveNoteId } = useNotesPageState();
  const [openingDiaryId, setOpeningDiaryId] = useState<string | null>(null);
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);
  const [dropdownsLoading, setDropdownsLoading] = useState(true);
  const [tagSettings, setTagSettings] = useState<TagSettingItem[]>([]);
  const loading = tradesLoading || dropdownsLoading;
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingTrade, setEditingTrade] = useState<Trade | null>(null);
  const [duplicateSource, setDuplicateSource] = useState<Trade | null>(null);
  const { filters, setFilters, sort, setSort, pendingTradeId, setPendingTradeId } = useTradesPageState();
  // Typing in the filter bar or changing sort updates `filters`/`sort` (and
  // their controls) immediately; this combined, deferred copy is what
  // actually drives the filter+sort+row-render pipeline below, so neither
  // one can block on re-processing the full trades list. Bundling both into
  // one object — rather than deferring each state variable separately — means
  // any future filter/sort field added here is automatically covered too;
  // deferring `filters` alone but not `sort` is exactly what caused the
  // 736ms INP warning on the mobile sort dropdown.
  const deferredView = useDeferredValue({ filters, sort });
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  async function loadDropdowns() {
    if (!selectedAccount) return;
    setDropdownsLoading(true);
    const { data } = await fetchDropdownItems(selectedAccount.id);
    if (data) setDropdowns(data as DropdownItem[]);
    setDropdownsLoading(false);
  }

  useEffect(() => {
    loadDropdowns();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  // Tag setting migration part 2: tags now come from the dedicated
  // Tag setting migration part 2 (updated): the "+ Tag" bulk-add chip list
  // now sources from every tag actually in use (fetchDistinctTags) rather
  // than the old curated tag_settings list — that list is no longer
  // maintained via the UI as of the Tag setting reshape, so it would
  // otherwise silently go stale. Synthesized into TagSettingItem shape
  // (BulkActionsBar only reads .id/.value) so the bar itself needed no
  // changes.
  useEffect(() => {
    if (!selectedAccount) {
      setTagSettings([]);
      return;
    }
    fetchDistinctTags(selectedAccount.id).then((tags) => {
      setTagSettings(
        tags.map((value, i) => ({
          id: value,
          account_id: selectedAccount.id,
          value,
          sort_order: i,
          created_at: "",
        }))
      );
    });
  }, [selectedAccount?.id]);

  useEffect(() => {
    exitSelectionMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Lets a keyboard user back out of selection mode quickly without hunting
  // for the Cancel button, matching the convention used by the screenshot lightbox.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectionMode((prev) => {
        if (prev) setSelectedIds(new Set());
        return false;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visibleTrades = useMemo(
    () => applySort(applyFilters(trades, deferredView.filters), deferredView.sort),
    [trades, deferredView]
  );

  const summary = useMemo(() => summarizeTrades(visibleTrades), [visibleTrades]);

  // tagSettings is now itself "tags in use" (see the effect above), so this
  // union with trades' own tags is redundant but harmless — kept as a
  // belt-and-suspenders fallback in case tagSettings hasn't loaded yet.
  const availableTags = useMemo(() => {
    const active = tagSettings.map((t) => t.value);
    const used = trades.flatMap((t) => t.tags ?? []);
    return Array.from(new Set([...active, ...used])).sort();
  }, [tagSettings, trades]);

  function openNew() {
    setEditingTrade(null);
    setDuplicateSource(null);
    setPanelOpen(true);
  }

  const openEdit = useCallback((trade: Trade) => {
    setEditingTrade(trade);
    setDuplicateSource(null);
    setPanelOpen(true);
  }, []);

  // Picks up a "jump to this trade" request set by the Notes page (a
  // linked-trade chip click, via TradesPageStateContext.pendingTradeId —
  // see lib/TradesPageStateContext.tsx). Waits for trades to finish
  // loading so the lookup isn't run against an empty list on a fresh
  // navigation, then opens it in TradeFormPanel exactly like clicking the
  // row would. Clears pendingTradeId either way (found or not — e.g. the
  // trade was since deleted) so it doesn't fire again on a later, unrelated
  // visit to this page.
  useEffect(() => {
    if (!pendingTradeId || tradesLoading) return;
    const target = trades.find((t) => t.id === pendingTradeId);
    if (target) openEdit(target);
    setPendingTradeId(null);
  }, [pendingTradeId, tradesLoading, trades, openEdit, setPendingTradeId]);

  const openDuplicate = useCallback((trade: Trade) => {
    setEditingTrade(null);
    setDuplicateSource(trade);
    setPanelOpen(true);
  }, []);

  function closePanel() {
    setPanelOpen(false);
    setEditingTrade(null);
    setDuplicateSource(null);
  }

  async function handleSaved() {
    closePanel();
    await refreshTrades();
  }

  /**
   * "Diary" button in TradeFormPanel (only shown for an existing, saved
   * trade). Finds the one note already linked to this trade and jumps to
   * it, or — if none exists yet — creates a blank note pre-linked to this
   * trade first. Either way, ends by handing off to the Notes page: sets
   * NotesPageStateContext.activeNoteId (mounted at the root layout, so
   * it's already the right value by the time Notes mounts and does its own
   * fetch) and navigates there. No local trades-page state needs updating
   * for this — nothing about the trade itself changed.
   */
  async function handleOpenDiary(trade: Trade) {
    if (!selectedAccount || openingDiaryId) return;
    setOpeningDiaryId(trade.id);
    const { data: existing } = await findNoteLinkedToTrade(selectedAccount.id, trade.id);
    let noteId = existing?.id ?? null;
    if (!noteId) {
      const { data: created, error } = await createNote(selectedAccount.id, [trade.id]);
      if (error || !created) {
        setOpeningDiaryId(null);
        return;
      }
      noteId = created.id;
    }
    setActiveNoteId(noteId);
    setOpeningDiaryId(null);
    router.push("/notes");
  }

  const handleDelete = useCallback(async (id: string) => {
    const trade = trades.find((t) => t.id === id);
    setDeleteError(null);
    const { error } = await deleteTrade(id);
    if (error) {
      setDeleteError("Couldn't delete this trade. Please try again.");
      return;
    }
    if (trade?.screenshot_url) {
      deleteScreenshot({ url: trade.screenshot_url, fileId: trade.screenshot_file_id ?? null }).catch(() => {});
    }
    await refreshTrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trades]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allCurrentlySelected =
        visibleTrades.length > 0 && visibleTrades.every((t) => prev.has(t.id));
      return allCurrentlySelected ? new Set() : new Set(visibleTrades.map((t) => t.id));
    });
  }, [visibleTrades]);

  const selectRange = useCallback((ids: string[]) => {
    setSelectedIds((prev) => new Set([...prev, ...ids]));
  }, []);

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setDeleteError(null);
    const targets = trades.filter((t) => ids.includes(t.id));
    const { error } = await deleteTrades(ids);
    if (error) {
      setDeleteError("Couldn't delete the selected trades. Please try again.");
      return;
    }
    targets.forEach((t) => {
      if (t.screenshot_url) {
        deleteScreenshot({ url: t.screenshot_url, fileId: t.screenshot_file_id ?? null }).catch(() => {});
      }
    });
    exitSelectionMode();
    await refreshTrades();
  }

  async function handleBulkAddTag(tag: string) {
    const ids = Array.from(selectedIds);
    const targets = trades.filter((t) => ids.includes(t.id) && !(t.tags ?? []).includes(tag));
    await Promise.all(targets.map((t) => updateTradeTags(t.id, [...t.tags, tag])));
    await refreshTrades();
  }

  async function handleBulkRemoveTag(tag: string) {
    const ids = Array.from(selectedIds);
    const targets = trades.filter((t) => ids.includes(t.id) && (t.tags ?? []).includes(tag));
    await Promise.all(targets.map((t) => updateTradeTags(t.id, t.tags.filter((existing) => existing !== tag))));
    await refreshTrades();
  }

  async function handleBulkSetRules(value: boolean) {
    const ids = Array.from(selectedIds);
    await Promise.all(ids.map((id) => updateTradeRules(id, value)));
    await refreshTrades();
  }

  function handleBulkExport() {
    const ids = Array.from(selectedIds);
    const targets = trades.filter((t) => ids.includes(t.id));
    const csv = tradesToCsv(targets);
    const accountSlug = selectedAccount ? slugify(selectedAccount.name) : "account";
    downloadCsv(csv, `${accountSlug}-selected-trades.csv`);
  }

  const selectedTrades = useMemo(
    () => trades.filter((t) => selectedIds.has(t.id)),
    [trades, selectedIds]
  );
  const removableTags = useMemo(
    () => Array.from(new Set(selectedTrades.flatMap((t) => t.tags ?? []))).sort(),
    [selectedTrades]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Trades</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectionMode
              ? `${selectedIds.size} selected`
              : selectedAccount
              ? `${trades.length} trade${trades.length === 1 ? "" : "s"} logged for ${selectedAccount.name}`
              : "Log and manage every trade."}
          </p>
        </div>
        {selectionMode ? (
          <button
            onClick={exitSelectionMode}
            className="shrink-0 text-sm text-ink-secondary hover:text-ink-primary font-medium px-4 py-1.5 rounded-full border border-surface-border"
          >
            Cancel
          </button>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setSelectionMode(true)}
              disabled={!selectedAccount || visibleTrades.length === 0}
              className="text-sm text-ink-secondary hover:text-ink-primary font-medium px-4 py-1.5 rounded-full border border-surface-border disabled:opacity-50"
            >
              Select
            </button>
            <button
              onClick={openNew}
              disabled={!selectedAccount}
              className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full disabled:opacity-50"
            >
              New trade
            </button>
          </div>
        )}
      </div>

      {selectedIds.size > 0 && (
        <BulkActionsBar
          count={selectedIds.size}
          tagOptions={tagSettings}
          removableTags={removableTags}
          onAddTag={handleBulkAddTag}
          onRemoveTag={handleBulkRemoveTag}
          onSetRules={handleBulkSetRules}
          onExport={handleBulkExport}
          onDelete={handleBulkDelete}
          onClear={exitSelectionMode}
        />
      )}

      {accountLoading || loading ? (
        <TradesSkeleton />
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <>
          <TradesPerformanceRibbon summary={summary} currency={selectedAccount.currency} trades={visibleTrades} />
          <TradesFilterBar
            filters={filters}
            onChange={setFilters}
            dropdowns={dropdowns}
            availableTags={availableTags}
          />
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
            onDuplicate={openDuplicate}
            onDelete={handleDelete}
            sort={sort}
            onSortChange={setSort}
            selectionMode={selectionMode}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onSelectRange={selectRange}
            onEnterSelectionMode={enterSelectionMode}
          />
        </>
      )}

      {panelOpen && (
        <TradeFormPanel
          trade={editingTrade}
          duplicateFrom={duplicateSource}
          onClose={closePanel}
          onSaved={handleSaved}
          onOpenDiary={handleOpenDiary}
          openingDiary={editingTrade != null && openingDiaryId === editingTrade.id}
        />
      )}
    </div>
  );
}
