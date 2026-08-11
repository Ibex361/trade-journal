"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "@/lib/AccountContext";
import {
  ContractSizeOverride,
  fetchContractSizeOverrideList,
  upsertContractSizeOverride,
  deleteContractSizeOverride,
} from "@/lib/exnessContractOverrides";
import SettingsCard from "./SettingsCard";

/**
 * "Broker import" setting — lets you type any Exness instrument symbol and
 * set the contract size used to convert that symbol's imported "lots" into
 * this app's "units" size convention (see contractSizeFor in
 * lib/exnessContractSize.ts). Deliberately not a dropdown/list of every
 * possible instrument — that would clutter the settings page for symbols
 * most accounts never trade. Instead this mirrors TagSettingCard's
 * type-to-find-or-create pattern: type a symbol, autocomplete offers only
 * symbols you've already overridden (nothing on a fresh account), and
 * typing a brand-new one just falls through to "no match" so you can set
 * its size for the first time.
 */

type Mode = "idle" | "editing";

export default function ExnessContractSizeCard() {
  const { selectedAccount } = useAccount();
  const [overrides, setOverrides] = useState<ContractSizeOverride[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  // Position of the panel when portalled to document.body — same fix as
  // TagSettingCard: every Card's own backdrop-blur creates a stacking
  // context that a plain `absolute` child can't paint above, so the panel
  // is portalled and positioned from the input's bounding rect instead.
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const [selected, setSelected] = useState<ContractSizeOverride | null>(null);
  // A symbol typed that doesn't match any existing override yet — lets
  // "set a size for a brand-new symbol" reuse the same edit form as
  // "change an existing override's size".
  const [newSymbol, setNewSymbol] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [sizeValue, setSizeValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const list = await fetchContractSizeOverrideList(selectedAccount.id);
    setOverrides(list);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load's setLoading(true) runs before its first await, same pattern as TagSettingCard.
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
    setSizeValue("");
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
      // No autocomplete match (or panel closed) — treat whatever's typed
      // as a symbol to look up or create, same as TagSettingCard's
      // exact-match fallback, but here a non-match is expected and fine
      // (a fresh symbol) rather than a no-op.
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
    const current = selected?.contract_size;
    setMode("editing");
    setSizeValue(current !== undefined ? String(current) : "");
    setErrorMsg(null);
    setFeedback(null);
  }

  async function confirmSave() {
    const symbol = selected?.symbol ?? newSymbol;
    if (!selectedAccount || !symbol) return;
    const parsed = Number(sizeValue);
    if (!sizeValue.trim() || !Number.isFinite(parsed) || parsed <= 0) {
      setErrorMsg("Enter a contract size greater than 0.");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const { error } = await upsertContractSizeOverride(selectedAccount.id, symbol, parsed);
    setBusy(false);
    if (error) {
      setErrorMsg("Couldn't save this contract size. Please try again.");
      return;
    }
    setFeedback(`Saved ${symbol} as ${parsed} unit${parsed === 1 ? "" : "s"} per lot.`);
    resetSelection();
    setQuery("");
    load();
  }

  async function confirmDelete() {
    if (!selectedAccount || !selected) return;
    setBusy(true);
    setErrorMsg(null);
    const { error } = await deleteContractSizeOverride(selectedAccount.id, selected.symbol);
    setBusy(false);
    if (error) {
      setErrorMsg("Couldn't remove this override. Please try again.");
      return;
    }
    setFeedback(`Removed the override for ${selected.symbol}.`);
    resetSelection();
    setQuery("");
    load();
  }

  const activeSymbol = selected?.symbol ?? newSymbol;

  return (
    <SettingsCard
      title="Broker import"
      description="Set the contract size Exness imports use for a symbol, so imported trade sizes match how you log them manually. Only symbols you've set are listed here — everything else uses this app's built-in defaults."
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
            // Mobile keyboards (Samsung Internet's included) often don't
            // fire a real Enter keydown on the "Go"/"Done" action key, so
            // tapping away is the only reliable signal that the user is
            // finished typing a symbol — commit on blur as a fallback to
            // the Enter handler above, not a replacement for it.
            setIsOpen(false);
            commitQuery();
          }}
          placeholder={loading ? "Loading…" : "Type a symbol, e.g. XAUUSD…"}
          disabled={loading}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="exness-contract-size-listbox"
          aria-autocomplete="list"
          className="w-full bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm disabled:opacity-50"
        />

        {showPanel && panelRect &&
          createPortal(
            <ul
              ref={panelRef}
              id="exness-contract-size-listbox"
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
          No overrides set yet — type a symbol above to set its contract size.
        </p>
      )}

      {!loading && overrides.length > 0 && (
        <ul className="text-xs text-ink-secondary mt-3 space-y-1">
          {overrides.map((o) => (
            <li key={o.id} className="flex items-center justify-between">
              <span>{o.symbol}</span>
              <span className="text-ink-muted">{o.contract_size} unit{o.contract_size === 1 ? "" : "s"}/lot</span>
            </li>
          ))}
        </ul>
      )}

      {selected && mode === "idle" && (
        <div className="flex items-center justify-between bg-surface-2 border border-surface-border rounded-md px-3 py-2 mt-3">
          <span className="text-sm">
            {selected.symbol} — {selected.contract_size} unit{selected.contract_size === 1 ? "" : "s"}/lot
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
            No override set for &quot;{newSymbol}&quot; yet — it currently uses this app&apos;s built-in default.
          </p>
          <button onClick={startEdit} className="text-xs text-glow font-medium hover:underline">
            Set contract size
          </button>
        </div>
      )}

      {activeSymbol && mode === "editing" && (
        <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2.5 mt-3 space-y-2">
          <p className="text-[11px] text-ink-secondary">
            Contract size for &quot;{activeSymbol}&quot; (units per 1.00 lot):
          </p>
          <div className="flex items-center gap-2">
            <input
              value={sizeValue}
              onChange={(e) => setSizeValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmSave()}
              type="number"
              min="0"
              step="any"
              autoFocus
              className="flex-1 bg-surface-0 border border-surface-border rounded-md px-3 py-1.5 text-sm"
            />
            <button
              onClick={confirmSave}
              disabled={busy || !sizeValue.trim()}
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
