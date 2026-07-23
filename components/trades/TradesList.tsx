"use client";

import { useEffect, useRef, useState } from "react";
import { Trade } from "@/lib/trades";

export type SortColumn = "entry_date" | "instrument" | "pnl" | "r_multiple";
export type SortState = { column: SortColumn; direction: "asc" | "desc" };

const LONG_PRESS_MS = 450;

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PnlText({ value, className = "" }: { value: number; className?: string }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono ${color} ${className}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onConfirm}
          className="text-xs text-loss font-medium hover:underline"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-ink-muted hover:text-ink-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-ink-muted hover:text-loss"
    >
      Delete
    </button>
  );
}

function RulesBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-ink-muted text-xs">—</span>;
  return value ? (
    <span className="text-gain text-xs">Yes</span>
  ) : (
    <span className="text-loss text-xs">No</span>
  );
}

function ScreenshotThumb({ url, onOpen }: { url: string | null; onOpen: () => void }) {
  if (!url) return <span className="text-ink-muted text-xs">—</span>;
  return (
    <button
      onClick={onOpen}
      className="w-9 h-9 rounded-md overflow-hidden border border-surface-border hover:border-brass/60 transition-colors"
      aria-label="View chart screenshot"
    >
      <img src={url} alt="" className="w-full h-full object-cover" />
    </button>
  );
}

function ScreenshotLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <img
        src={url}
        alt="Trade chart screenshot"
        className="relative max-w-full max-h-full rounded-lg border border-surface-border"
      />
      <button
        onClick={onClose}
        className="absolute top-6 right-6 text-ink-primary/80 hover:text-ink-primary text-2xl leading-none"
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}

function SortHeader({
  label,
  column,
  sort,
  onSortChange,
  align = "left",
}: {
  label: string;
  column: SortColumn;
  sort: SortState;
  onSortChange: (s: SortState) => void;
  align?: "left" | "right";
}) {
  const active = sort.column === column;

  function handleClick() {
    if (active) {
      onSortChange({ column, direction: sort.direction === "asc" ? "desc" : "asc" });
    } else {
      onSortChange({ column, direction: column === "instrument" ? "asc" : "desc" });
    }
  }

  return (
    <button
      onClick={handleClick}
      className={`flex items-center gap-1 font-medium transition-colors hover:text-ink-primary ${
        active ? "text-ink-primary" : ""
      } ${align === "right" ? "ml-auto" : ""}`}
    >
      {label}
      <span className={`text-brass ${active ? "" : "opacity-0"}`}>
        {sort.direction === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}

export default function TradesList({
  trades,
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
  const allSelected = trades.length > 0 && trades.every((t) => selectedIds.has(t.id));

  // Long-press (or mouse-hold) support so selection mode can be entered by
  // pressing a trade directly, the way most mobile apps handle multi-select,
  // rather than checkboxes sitting on screen permanently.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  function clearPressTimer() {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }

  function startPress(id: string, target: EventTarget) {
    if ((target as HTMLElement).closest("button, a, input")) return;
    longPressFired.current = false;
    clearPressTimer();
    pressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onEnterSelectionMode(id);
    }, LONG_PRESS_MS);
  }

  // In selection mode, tapping anywhere on the row (outside its buttons)
  // toggles that row, not just the checkbox — matching how mail/file apps
  // behave once you're already in a multi-select state.
  function handleRowClick(e: React.MouseEvent, id: string) {
    if (longPressFired.current) {
      longPressFired.current = false;
      return;
    }
    if (!selectionMode) return;
    if ((e.target as HTMLElement).closest("button, a")) return;
    onToggleSelect(id);
  }

  // Shift-click extends the selection to every row between the last checkbox
  // clicked and this one (inclusive) — the standard file-manager convention,
  // so selecting a long run of trades doesn't mean clicking each one.
  function handleCheckboxClick(e: React.MouseEvent<HTMLInputElement>, id: string, index: number) {
    e.stopPropagation();
    if (e.shiftKey && lastClickedIndex !== null) {
      e.preventDefault();
      const [start, end] = index < lastClickedIndex ? [index, lastClickedIndex] : [lastClickedIndex, index];
      onSelectRange(trades.slice(start, end + 1).map((t) => t.id));
    } else {
      onToggleSelect(id);
    }
    setLastClickedIndex(index);
  }

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
                    className="accent-brass"
                  />
                </th>
              )}
              <th className="px-4 py-3">
                <SortHeader label="Date" column="entry_date" sort={sort} onSortChange={onSortChange} />
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
              <tr
                key={t.id}
                onPointerDown={(e) => startPress(t.id, e.target)}
                onPointerUp={clearPressTimer}
                onPointerLeave={clearPressTimer}
                onPointerCancel={clearPressTimer}
                onContextMenu={(e) => {
                  if (longPressFired.current) e.preventDefault();
                }}
                onClick={(e) => handleRowClick(e, t.id)}
                className={`border-b border-surface-border last:border-0 transition-colors select-none ${
                  selectedIds.has(t.id) ? "bg-brass/10 hover:bg-brass/15" : "hover:bg-surface-2/50"
                } ${selectionMode ? "cursor-pointer" : ""}`}
                style={{ touchAction: "manipulation" }}
              >
                {selectionMode && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(t.id)}
                      onChange={() => {}}
                      onClick={(e) => handleCheckboxClick(e, t.id, index)}
                      aria-label={`Select trade ${t.instrument}`}
                      className="accent-brass"
                    />
                  </td>
                )}
                <td className="px-4 py-3 font-mono text-ink-secondary whitespace-nowrap">
                  {formatDate(t.entry_date)}
                </td>
                <td className="px-4 py-3 font-medium">{t.instrument}</td>
                <td className="px-4 py-3 capitalize text-ink-secondary">
                  {t.direction ?? "—"}
                </td>
                <td className="px-4 py-3 text-ink-secondary">{t.asset_class ?? "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{t.strategy ?? "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{t.session ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <PnlText value={t.pnl} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink-secondary">
                  {t.r_multiple !== null ? t.r_multiple.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3">
                  <RulesBadge value={t.rules_followed} />
                </td>
                <td className="px-4 py-3">
                  <ScreenshotThumb url={t.screenshot_url} onOpen={() => setLightboxUrl(t.screenshot_url)} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => onEdit(t)}
                      className="text-xs text-ink-secondary hover:text-brass"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDuplicate(t)}
                      className="text-xs text-ink-secondary hover:text-brass"
                    >
                      Duplicate
                    </button>
                    <DeleteButton onConfirm={() => onDelete(t.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile sort control — the desktop table has per-column sort headers,
          but that whole table is hidden on small screens, which meant sorting
          wasn't reachable at all on mobile. */}
      <div className="md:hidden flex items-center gap-2 mb-3">
        <span className="text-[11px] text-ink-secondary">Sort by</span>
        <select
          value={sort.column}
          onChange={(e) => {
            const column = e.target.value as SortColumn;
            onSortChange({ column, direction: column === "instrument" ? "asc" : "desc" });
          }}
          className="bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary"
        >
          <option value="entry_date">Date</option>
          <option value="instrument">Instrument</option>
          <option value="pnl">P&amp;L</option>
          <option value="r_multiple">R</option>
        </select>
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
              className="accent-brass"
            />
            <span className="text-[11px] text-ink-secondary">Select all</span>
          </div>
        )}
        {trades.map((t, index) => (
          <div
            key={t.id}
            onPointerDown={(e) => startPress(t.id, e.target)}
            onPointerUp={clearPressTimer}
            onPointerLeave={clearPressTimer}
            onPointerCancel={clearPressTimer}
            onContextMenu={(e) => {
              if (longPressFired.current) e.preventDefault();
            }}
            onClick={(e) => handleRowClick(e, t.id)}
            className={`border rounded-card p-4 transition-colors select-none ${
              selectedIds.has(t.id)
                ? "bg-brass/10 border-brass/40"
                : "bg-surface-1 border-surface-border"
            }`}
            style={{ touchAction: "manipulation" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                {selectionMode && (
                  <input
                    type="checkbox"
                    checked={selectedIds.has(t.id)}
                    onChange={() => {}}
                    onClick={(e) => handleCheckboxClick(e, t.id, index)}
                    aria-label={`Select trade ${t.instrument}`}
                    className="accent-brass mt-1"
                  />
                )}
                <span className="signal-bar h-8" />
                <div>
                  <p className="font-medium">{t.instrument}</p>
                  <p className="text-xs text-ink-secondary font-mono">
                    {formatDate(t.entry_date)} · <span className="capitalize">{t.direction ?? "—"}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <ScreenshotThumb url={t.screenshot_url} onOpen={() => setLightboxUrl(t.screenshot_url)} />
                <PnlText value={t.pnl} className="text-base" />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ink-secondary">
              {t.asset_class && <span>{t.asset_class}</span>}
              {t.strategy && <span>{t.strategy}</span>}
              {t.session && <span>{t.session}</span>}
              {t.r_multiple !== null && <span className="font-mono">{t.r_multiple.toFixed(1)}R</span>}
              <span className="flex items-center gap-1">
                Rules: <RulesBadge value={t.rules_followed} />
              </span>
            </div>

            <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t border-surface-border">
              <button
                onClick={() => onEdit(t)}
                className="text-xs text-ink-secondary hover:text-brass"
              >
                Edit
              </button>
              <button
                onClick={() => onDuplicate(t)}
                className="text-xs text-ink-secondary hover:text-brass"
              >
                Duplicate
              </button>
              <DeleteButton onConfirm={() => onDelete(t.id)} />
            </div>
          </div>
        ))}
      </div>

      {lightboxUrl && (
        <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
      )}
    </>
  );
}
