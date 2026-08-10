"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Trade } from "@/lib/trades";
import { getTradeRowEmphasis } from "@/lib/metrics";
import { Select } from "@/components/shared/Select";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import DesktopRow from "./trades-list/DesktopRow";
import MobileCard from "./trades-list/MobileCard";
import {
  formatDate,
  RowCallbacks,
  ScreenshotLightbox,
  SortColumn,
  SortHeader,
  SortState,
} from "./trades-list/rowParts";

export type { SortColumn, SortState };

const LONG_PRESS_MS = 450;

// Previously a single 712-line file. DesktopRow, MobileCard, and the small
// shared row primitives (PnlText, DeleteButton, RulesBadge, ScreenshotThumb,
// ScreenshotLightbox, SortHeader, formatDate/formatTime) now live under
// ./trades-list — mirrors the trade-form/ split of TradeFormPanel.tsx.
// This file keeps the selection/long-press state and the desktop table /
// mobile card shells that both row components render into.
function TradesList({
  trades,
  totalCount,
  onLoadMore,
  onEdit,
  onDuplicate,
  onDelete,
  sort,
  onSortChange,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onSelectRange,
  onEnterSelectionMode,
}: {
  trades: Trade[];
  /**
   * Count of all trades matching the current filter/sort, before the
   * reveal-count slice below is applied — i.e. `trades.length` is what's
   * currently rendered, `totalCount` is what's rendered once every "load
   * more" batch has fired. Drives the "Showing N of M" label and whether
   * the scroll sentinel below has anything left to reveal.
   */
  totalCount: number;
  /**
   * Called when the scroll sentinel enters the viewport. Owner (the Trades
   * page) is responsible for growing revealCount — this component has no
   * opinion on batch size, it only reports "the user scrolled to the end
   * of what's currently shown."
   */
  onLoadMore: () => void;
  onEdit: (trade: Trade) => void;
  onDuplicate: (trade: Trade) => void;
  onDelete: (id: string) => void;
  sort: SortState;
  onSortChange: (s: SortState) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onSelectRange: (ids: string[]) => void;
  onEnterSelectionMode: (id: string) => void;
}) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);
  // One shared confirm dialog for the whole list, rather than the old
  // per-row inline "Delete" -> "Confirm" swap (see DeleteButton in
  // rowParts.tsx for why that pattern was risky). Holding just the id
  // keeps this cheap even on a long revealed list.
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTrade = pendingDeleteId ? trades.find((t) => t.id === pendingDeleteId) ?? null : null;

  const requestDelete = useCallback((id: string) => setPendingDeleteId(id), []);
  const cancelDelete = useCallback(() => setPendingDeleteId(null), []);
  const confirmDelete = useCallback(() => {
    if (pendingDeleteId) onDelete(pendingDeleteId);
    setPendingDeleteId(null);
  }, [pendingDeleteId, onDelete]);
  // Compared against totalCount (every trade matching the current filter),
  // not trades.length (just what's currently revealed) — otherwise, with
  // more unrevealed trades below the fold, checking every visible row would
  // show this as "all selected" while onToggleSelectAll (which operates on
  // the full filtered set) would still have more to select. Keeping this
  // checkbox's checked state and its click behavior talking about the same
  // set avoids that mismatch.
  const allSelected = totalCount > 0 && selectedIds.size === totalCount;

  // Content-aware: scale each row's P&L bar to the largest mover currently
  // in view, and flag the single best/worst visible trade — mirrors the
  // same treatment on Dashboard's Recent trades feed and Reports' monthly
  // table (both go through the same getTradeRowEmphasis helper so the
  // three views can never disagree). Memoized on `trades` specifically —
  // this used to re-scan the whole list on every render, including every
  // row selection, which is exactly what showed up as a 520ms INP warning
  // on tap.
  const { maxAbsPnl, bestId, worstId } = useMemo(() => getTradeRowEmphasis(trades), [trades]);

  // Long-press (or mouse-hold) support so selection mode can be entered by
  // pressing a trade directly, the way most mobile apps handle multi-select,
  // rather than checkboxes sitting on screen permanently.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const startPress = useCallback(
    (id: string, target: EventTarget) => {
      if ((target as HTMLElement).closest("button, a, input")) return;
      longPressFired.current = false;
      clearPressTimer();
      pressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        onEnterSelectionMode(id);
      }, LONG_PRESS_MS);
    },
    [clearPressTimer, onEnterSelectionMode]
  );

  const onContextMenuGuard = useCallback((e: React.MouseEvent) => {
    if (longPressFired.current) e.preventDefault();
  }, []);

  // In selection mode, tapping anywhere on the row (outside its buttons)
  // toggles that row, not just the checkbox — matching how mail/file apps
  // behave once you're already in a multi-select state.
  const handleRowClick = useCallback(
    (e: React.MouseEvent, id: string) => {
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }
      if (!selectionMode) return;
      if ((e.target as HTMLElement).closest("button, a")) return;
      onToggleSelect(id);
    },
    [selectionMode, onToggleSelect]
  );

  // Shift-click extends the selection to every row between the last checkbox
  // clicked and this one (inclusive) — the standard file-manager convention,
  // so selecting a long run of trades doesn't mean clicking each one.
  const handleCheckboxClick = useCallback(
    (e: React.MouseEvent<HTMLInputElement>, id: string, index: number) => {
      e.stopPropagation();
      if (e.shiftKey && lastClickedIndex !== null) {
        e.preventDefault();
        const [start, end] = index < lastClickedIndex ? [index, lastClickedIndex] : [lastClickedIndex, index];
        onSelectRange(trades.slice(start, end + 1).map((t) => t.id));
      } else {
        onToggleSelect(id);
      }
      setLastClickedIndex(index);
    },
    [lastClickedIndex, trades, onSelectRange, onToggleSelect]
  );

  const openScreenshot = useCallback((url: string) => setLightboxUrl(url), []);

  // Infinite-scroll trigger: an IntersectionObserver on a sentinel div below
  // the last rendered row, rather than an onScroll pixel-threshold listener.
  // Avoids scroll-event throttling and works regardless of row height, which
  // varies here (desktop table rows vs. mobile cards, and either can grow
  // when a screenshot thumb or long notes value is present). Re-observes
  // whenever there's more to reveal (trades.length < totalCount); once
  // everything is revealed the sentinel unmounts and observation stops.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = trades.length < totalCount;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "400px" } // fire a bit before the sentinel is actually on-screen, so the next batch is ready by the time the user scrolls to it
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  const rowCallbacks: RowCallbacks = {
    onEdit,
    onDuplicate,
    onRequestDelete: requestDelete,
    onOpenScreenshot: openScreenshot,
    onRowClick: handleRowClick,
    onCheckboxClick: handleCheckboxClick,
    onPointerDown: startPress,
    onPointerUp: clearPressTimer,
    onPointerLeave: clearPressTimer,
    onPointerCancel: clearPressTimer,
    onContextMenuGuard,
  };

  if (trades.length === 0) {
    return (
      <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
        <p className="text-ink-muted text-sm">No trades match the current filters.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-surface-1 border border-surface-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-ink-secondary text-xs uppercase tracking-wide">
              {selectionMode && (
                <th className="px-4 py-3 w-8">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    aria-label="Select all trades"
                    className="accent-glow"
                  />
                </th>
              )}
              <th className="px-4 py-3">
                <SortHeader label="Entry" column="entry_date" sort={sort} onSortChange={onSortChange} />
              </th>
              <th className="px-4 py-3">
                <SortHeader label="Instrument" column="instrument" sort={sort} onSortChange={onSortChange} />
              </th>
              <th className="px-4 py-3 font-medium">Dir</th>
              <th className="px-4 py-3 font-medium">Asset class</th>
              <th className="px-4 py-3 font-medium">Strategy</th>
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="P&L" column="pnl" sort={sort} onSortChange={onSortChange} align="right" />
              </th>
              <th className="px-4 py-3 text-right">
                <SortHeader label="R" column="r_multiple" sort={sort} onSortChange={onSortChange} align="right" />
              </th>
              <th className="px-4 py-3 font-medium">Rules</th>
              <th className="px-4 py-3 font-medium">Chart</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t, index) => (
              <DesktopRow
                key={t.id}
                trade={t}
                index={index}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(t.id)}
                isBest={bestId === t.id}
                isWorst={worstId === t.id}
                maxAbsPnl={maxAbsPnl}
                {...rowCallbacks}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile sort control — the desktop table has per-column sort headers,
          but that whole table is hidden on small screens, which meant sorting
          wasn't reachable at all on mobile. */}
      <div className="md:hidden flex items-center gap-2 mb-3">
        <span className="text-[11px] text-ink-secondary">Sort by</span>
        <Select
          value={sort.column}
          onChange={(v) => {
            const column = v as SortColumn;
            onSortChange({ column, direction: column === "instrument" ? "asc" : "desc" });
          }}
          options={[
            { value: "entry_date", label: "Entry date" },
            { value: "instrument", label: "Instrument" },
            { value: "pnl", label: "P&L" },
            { value: "r_multiple", label: "R" },
          ]}
        />
        <button
          type="button"
          onClick={() => onSortChange({ column: sort.column, direction: sort.direction === "asc" ? "desc" : "asc" })}
          className="bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-secondary hover:text-ink-primary"
          aria-label="Toggle sort direction"
        >
          {sort.direction === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {selectionMode && (
          <div className="flex items-center gap-2 px-1">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={onToggleSelectAll}
              aria-label="Select all trades"
              className="accent-glow"
            />
            <span className="text-[11px] text-ink-secondary">Select all</span>
          </div>
        )}
        {trades.map((t, index) => (
          <MobileCard
            key={t.id}
            trade={t}
            index={index}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(t.id)}
            isBest={bestId === t.id}
            isWorst={worstId === t.id}
            maxAbsPnl={maxAbsPnl}
            {...rowCallbacks}
          />
        ))}
      </div>

      {/* Reveal-count status + scroll sentinel. Shown even once hasMore is
          false (as "Showing M of M") so the count doesn't just disappear —
          only the sentinel itself is conditionally rendered, since an
          IntersectionObserver on a permanently-offscreen div would never
          need to fire once everything's loaded. */}
      <div className="flex items-center justify-center py-4">
        <span className="text-[11px] text-ink-muted">
          Showing {trades.length} of {totalCount} trade{totalCount === 1 ? "" : "s"}
        </span>
      </div>
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}

      {lightboxUrl && (
        <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}

      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete this trade?"
        description={
          pendingDeleteTrade
            ? `This permanently deletes the ${formatDate(pendingDeleteTrade.entry_date)} ${pendingDeleteTrade.instrument} trade. This can't be undone.`
            : "This permanently deletes the trade. This can't be undone."
        }
        confirmLabel="Delete trade"
        cancelLabel="Cancel"
        onCancel={cancelDelete}
        onConfirm={confirmDelete}
      />
    </>
  );
}

// Defense-in-depth: bails out entirely if TradesList's own props haven't
// changed (e.g. an unrelated bit of Trades-page state like a modal open/
// close), on top of the per-row memoization on DesktopRow/MobileCard.
export default memo(TradesList);
