"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "@/lib/AccountContext";
import {
  ChartSymbolOverride,
  fetchChartSymbolOverrideList,
  upsertChartSymbolOverride,
  deleteChartSymbolOverride,
} from "@/lib/chartSymbolOverrides";
import SettingsCard from "./SettingsCard";

/**
 * "Chart symbols" setting — lets you type any instrument symbol you log in
 * this app and set the Twelve Data symbol its "View chart" candlestick
 * chart should fetch (see resolveChartSymbol in lib/chartSymbolMap.ts).
 * Same shape and interaction pattern as ExnessContractSizeCard (type a
 * symbol, autocomplete offers only symbols you've already overridden,
 * typing a brand-new one falls through to "no match" so you can map it
 * for the first time) — deliberately not a dropdown of every possible
 * instrument, for the same reason that card gives.
 */

type Mode = "idle" | "editing";

export default function ChartSymbolCard() {
  const { selectedAccount } = useAccount();
  const [overrides, setOverrides] = useState<ChartSymbolOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  // Position of the panel when portalled to document.body — same fix as
  // ExnessContractSizeCard/TagSettingCard: every Card's own backdrop-blur
  // creates a stacking context a plain `absolute` child can't paint above.
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const [selected, setSelected] = useState<ChartSymbolOverride | null>(null);
  // A symbol typed that doesn't match any existing override yet — lets
  // "map a brand-new symbol" reuse the same edit form as "change an
  // existing override's Twelve Data symbol".
  const [newSymbol, setNewSymbol] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [symbolValue, setSymbolValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const list = await fetchChartSymbolOverrideList(selectedAccount.id);
    setOverrides(list);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load's setLoading(true) runs before its first await, same pattern as ExnessContractSizeCard.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  const allSymbols = useMemo(() => overrides.map((o) => o.symbol), [overrides]);

  const filteredMatches = useMemo(() => {
    const trimmed = query.trim().toUpperCase();
    if (!trimmed) return allSymbols.slice(0, 8);
    return allSymbols.filter((s) => s.includes(trimmed)).slice(0, 8);
  }, [allSymbols, query]);

  const showPanel = isOpen && filteredMatches.length > 0;

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedIndex(0);
  }, [filteredMatches.length, query]);

  useEffect(() => {
    if (!showPanel) return;
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showPanel]);

  useEffect(() => {
    if (!showPanel) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- panel closed; clear the computed position rather than leave a stale rect.
      setPanelRect(null);
      return;
    }
    function updateRect() {
      const el = inputRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPanelRect({ top: r.bottom + 4, left: r.left, width: r.width });
    }
    updateRect();
    window.addEventListener("scroll", updateRect, true);
    window.addEventListener("resize", updateRect);
    return () => {
      window.removeEventListener("scroll", updateRect, true);
      window.removeEventListener("resize", updateRect);
    };
  }, [showPanel]);

  function resetSelection() {
    setSelected(null);
    setNewSymbol(null);
    setMode("idle");
    setSymbolValue("");
    setErrorMsg(null);
  }

  function pickSymbol(symbol: string) {
    setQuery(symbol);
    setIsOpen(false);
    resetSelection();
    const existing = overrides.find((o) => o.symbol === symbol);
    if (existing) setSelected(existing);
    else setNewSymbol(symbol);
  }

  function commitQuery() {
    if (showPanel) {
      pickSymbol(filteredMatches[highlightedIndex]);
    } else if (query.trim() && query.trim().toUpperCase() !== activeSymbol) {
      pickSymbol(query.trim().toUpperCase());
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (showPanel && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const count = filteredMatches.length;
      setHighlightedIndex((i) => (e.key === "ArrowDown" ? (i + 1) % count : (i - 1 + count) % count));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      commitQuery();
      return;
    }
    if (e.key === "Escape" && showPanel) {
      setIsOpen(false);
    }
  }

  function startEdit() {
    const current = selected?.twelve_data_symbol;
    setMode("editing");
    setSymbolValue(current ?? "");
    setErrorMsg(null);
    setFeedback(null);
  }

  async function confirmSave() {
    const symbol = selected?.symbol ?? newSymbol;
    if (!selectedAccount || !symbol) return;
    const trimmed = symbolValue.trim();
    if (!trimmed) {
      setErrorMsg("Enter the Twelve Data symbol to chart against (e.g. XAU/USD).");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const { error } = await upsertChartSymbolOverride(selectedAccount.id, symbol, trimmed);
    setBusy(false);
    if (error) {
      setErrorMsg("Couldn't save this mapping. Please try again.");
      return;
    }
    setFeedback(`${symbol} will now chart against ${trimmed}.`);
    resetSelection();
    setQuery("");
    load();
  }

  async function confirmDelete() {
    if (!selectedAccount || !selected) return;
    setBusy(true);
    setErrorMsg(null);
    const { error } = await deleteChartSymbolOverride(selectedAccount.id, selected.symbol);
    setBusy(false);
    if (error) {
      setErrorMsg("Couldn't remove this mapping. Please try again.");
      return;
    }
    setFeedback(`Removed the chart mapping for ${selected.symbol}.`);
    resetSelection();
    setQuery("");
    load();
  }

  const activeSymbol = selected?.symbol ?? newSymbol;

  return (
    <SettingsCard
      title="Chart symbols"
      description="Map an instrument symbol you log to the Twelve Data symbol its &quot;View chart&quot; candlestick chart should fetch (e.g. XAUUSD → XAU/USD, US30 → DJI). Only symbols you&apos;ve mapped are listed here — everything else uses this app&apos;s built-in mapping, if one exists for it."
    >
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (activeSymbol && e.target.value.toUpperCase() !== activeSymbol) resetSelection();
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            // Mobile keyboards often don't fire a real Enter keydown on
            // the "Go"/"Done" action key — commit on blur as a fallback,
            // same as ExnessContractSizeCard.
            setIsOpen(false);
            commitQuery();
          }}
          placeholder={loading ? "Loading…" : "Type a symbol, e.g. XAUUSD…"}
          disabled={loading}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="chart-symbol-listbox"
          aria-autocomplete="list"
          className="w-full bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm disabled:opacity-50"
        />

        {showPanel && panelRect &&
          createPortal(
            <ul
              ref={panelRef}
              id="chart-symbol-listbox"
              role="listbox"
              style={{ top: panelRect.top, left: panelRect.left, width: panelRect.width }}
              className="fixed z-[100] max-h-48 overflow-auto p-1 bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass"
            >
              {filteredMatches.map((symbol, i) => (
                <li
                  key={symbol}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickSymbol(symbol);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={[
                    "flex items-center rounded-md px-2.5 py-1.5 text-xs cursor-pointer select-none",
                    i === highlightedIndex ? "bg-glow/15 text-glow" : "text-ink-primary",
                  ].join(" ")}
                >
                  {symbol}
                </li>
              ))}
            </ul>,
            document.body
          )}
      </div>

      {!loading && overrides.length === 0 && !activeSymbol && (
        <p className="text-sm text-ink-muted mt-3">
          No mappings set yet — type a symbol above, or rely on this app&apos;s built-in mapping for majors, gold/silver, the big indices, and top crypto pairs.
        </p>
      )}

      {!loading && overrides.length > 0 && (
        <ul className="text-xs text-ink-secondary mt-3 space-y-1">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center justify-between">
              <span>{o.symbol}</span>
              <span className="text-ink-muted font-mono">{o.twelve_data_symbol}</span>
            </li>
          ))}
        </ul>
      )}

      {selected && mode === "idle" && (
        <div className="flex items-center justify-between bg-surface-2 border border-surface-border rounded-md px-3 py-2 mt-3">
          <span className="text-sm">
            {selected.symbol} → <span className="font-mono">{selected.twelve_data_symbol}</span>
          </span>
          <div className="flex items-center gap-3">
            <button onClick={startEdit} className="text-xs text-glow hover:underline">
              Edit
            </button>
            <button onClick={confirmDelete} disabled={busy} className="text-xs text-loss/80 hover:text-loss disabled:opacity-50">
              {busy ? "Removing…" : "Delete"}
            </button>
          </div>
        </div>
      )}

      {newSymbol && mode === "idle" && (
        <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2.5 mt-3 space-y-2">
          <p className="text-[11px] text-ink-secondary">
            No mapping set for &quot;{newSymbol}&quot; yet — it currently uses this app&apos;s built-in mapping, if one exists.
          </p>
          <button onClick={startEdit} className="text-xs text-glow font-medium hover:underline">
            Map this symbol
          </button>
        </div>
      )}

      {activeSymbol && mode === "editing" && (
        <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2.5 mt-3 space-y-2">
          <p className="text-[11px] text-ink-secondary">
            Twelve Data symbol for &quot;{activeSymbol}&quot; (e.g. XAU/USD, DJI, BTC/USD):
          </p>
          <div className="flex items-center gap-2">
            <input
              value={symbolValue}
              onChange={(e) => setSymbolValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmSave()}
              autoFocus
              className="flex-1 bg-surface-0 border border-surface-border rounded-md px-3 py-1.5 text-sm font-mono"
            />
            <button
              onClick={confirmSave}
              disabled={busy || !symbolValue.trim()}
              className="text-xs text-glow font-medium hover:underline disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              onClick={resetSelection}
              disabled={busy}
              className="text-xs text-ink-muted hover:text-ink-primary"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {feedback && <p className="text-xs text-gain mt-3">{feedback}</p>}
      {errorMsg && <p className="text-xs text-loss mt-3">{errorMsg}</p>}
    </SettingsCard>
  );
}
