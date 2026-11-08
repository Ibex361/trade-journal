"use client";

import { useMemo, useRef, useState } from "react";
import type { Trade } from "@/lib/trades";

const MAX_RESULTS = 8;

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PnlText({ value }: { value: number }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono ${color}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

/**
 * Phase 3 part 3: lets a note optionally link to one or more trades it's
 * about. `trades` is the full account trade list (from TradesDataContext —
 * already scoped to the selected account, so nothing extra to fetch here).
 * When `onOpenTrade` is provided (NoteEditPanel always passes it), clicking
 * an already-linked chip's label jumps to that trade in the Trades page —
 * see app/notes/page.tsx's handleOpenTrade for the actual navigation, which
 * mirrors the Trades→Notes "diary" shortcut's pendingTradeId/activeNoteId
 * hand-off pattern in reverse.
 *
 * Search matches instrument only (not date/strategy) — trades don't have
 * enough of a natural-language identity for a broader fuzzy match to be
 * worth it here; instrument is what a user would actually type to find
 * "that EURUSD trade from last week".
 */
export default function LinkedTradesPicker({
  trades,
  linkedTradeIds,
  onChange,
  onOpenTrade,
}: {
  trades: Trade[];
  linkedTradeIds: string[];
  onChange: (ids: string[]) => void;
  onOpenTrade?: (trade: Trade) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const linkedTrades = useMemo(
    () => linkedTradeIds.map((id) => trades.find((t) => t.id === id)).filter((t): t is Trade => Boolean(t)),
    [linkedTradeIds, trades]
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return trades
      .filter((t) => !linkedTradeIds.includes(t.id) && t.instrument.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [query, trades, linkedTradeIds]);

  function addTrade(id: string) {
    onChange([...linkedTradeIds, id]);
    setQuery("");
    setOpen(false);
  }

  function removeTrade(id: string) {
    onChange(linkedTradeIds.filter((existing) => existing !== id));
  }

  return (
    <div>
      <span className="text-[11px] uppercase tracking-wide text-ink-muted">Linked trades</span>

      {linkedTrades.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-2">
          {linkedTrades.map((t) => (
            <span
              key={t.id}
              className="flex items-center gap-2 pl-3 pr-2 py-1 rounded-full text-xs border border-surface-border bg-surface-2 text-ink-secondary"
            >
              {onOpenTrade ? (
                <button
                  type="button"
                  onClick={() => onOpenTrade(t)}
                  title="Open this trade in Trades"
                  className="flex items-center gap-2 hover:text-glow transition-colors"
                >
                  <span className="text-ink-primary font-medium">{t.instrument}</span>
                  <span className="text-ink-muted">{formatDate(t.entry_date)}</span>
                  <PnlText value={t.pnl} />
                </button>
              ) : (
                <>
                  <span className="text-ink-primary font-medium">{t.instrument}</span>
                  <span className="text-ink-muted">{formatDate(t.entry_date)}</span>
                  <PnlText value={t.pnl} />
                </>
              )}
              <button
                type="button"
                onClick={() => removeTrade(t.id)}
                aria-label={`Unlink ${t.instrument}`}
                className="text-ink-muted hover:text-ink-primary leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={containerRef} className="relative mt-2">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder="Search trades by instrument to link…"
          className="w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-xs text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20 transition-colors"
        />

        {open && query.trim() && (
          <div className="absolute z-10 mt-1 w-full bg-surface-solid backdrop-blur-xl border border-surface-border rounded-md shadow-glass max-h-64 overflow-y-auto">
            {results.length === 0 ? (
              <p className="px-3 py-2 text-xs text-ink-muted">No matching trades.</p>
            ) : (
              results.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onMouseDown={() => addTrade(t.id)}
                  className="w-full flex items-center justify-between gap-3 px-3 py-2 text-xs text-left hover:bg-surface-2 transition-colors"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span className="text-ink-primary font-medium truncate">{t.instrument}</span>
                    <span className="text-ink-muted shrink-0">{formatDate(t.entry_date)}</span>
                  </span>
                  <PnlText value={t.pnl} />
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
