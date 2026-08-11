"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useAccount } from "@/lib/AccountContext";
import {
  fetchDistinctTags,
  renameTagEverywhere,
  deleteTagEverywhere,
  getTagUsageCount,
} from "@/lib/tagSettings";
import SettingsCard from "./SettingsCard";

/**
 * "Tag setting" — Part 2 of the freeform-tag work. No longer a curated
 * list you add to before a tag can be suggested (see Part 1: suggestions
 * now come from every tag actually in use). This card is purely a
 * rename/delete tool: type an existing tag's name — autocomplete-assisted
 * against the same "tags in use" list TagInput suggests from — then rename
 * or delete it everywhere it appears across trades and notes.
 */

type Mode = "idle" | "renaming" | "deleting";

export default function TagSettingCard() {
  const { selectedAccount } = useAccount();
  const [allTags, setAllTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  // Position of the panel when portalled to document.body — see the
  // "badly positioned" fix below. Recomputed from the input's own bounding
  // rect rather than relying on CSS `absolute`, since a portal escapes the
  // normal positioned-ancestor relationship entirely.
  const [panelRect, setPanelRect] = useState<{ top: number; left: number; width: number } | null>(null);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("idle");
  const [renameValue, setRenameValue] = useState("");
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [checkingUsage, setCheckingUsage] = useState(false);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const tags = await fetchDistinctTags(selectedAccount.id);
    setAllTags(tags);
    setLoading(false);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load's setLoading(true) runs before its first await, same as loadDropdowns in app/trades/page.tsx.
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  const filteredMatches = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return allTags.slice(0, 8);
    return allTags.filter((t) => t.toLowerCase().includes(trimmed)).slice(0, 8);
  }, [allTags, query]);

  const showPanel = isOpen && filteredMatches.length > 0;

  useEffect(() => {
    // Keeps the highlighted option in range as the filtered list changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedIndex(0);
  }, [filteredMatches.length, query]);

  useEffect(() => {
    if (!showPanel) return;
    // The panel is portalled to document.body (see below), so it's no
    // longer a DOM descendant of containerRef — checked separately here,
    // or every click on an option would register as an outside click and
    // close the panel before onMouseDown's pickTag could run.
    function handlePointerDown(e: MouseEvent) {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      setIsOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showPanel]);

  // Positioning fix: this panel used to render as a normal `absolute`
  // child, but every Card on the page has its own backdrop-blur (needed
  // for the app's glass-panel look), and backdrop-filter creates a new
  // CSS stacking context — so the *next* Card down the page (Dropdown
  // lists) painted over this panel regardless of z-index, since z-index
  // only resolves within a shared stacking context. Portalling to
  // document.body escapes that entirely; the tradeoff is the panel loses
  // its natural position relative to the input, so its coordinates are
  // computed here from the input's own bounding rect instead.
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
    setSelectedTag(null);
    setMode("idle");
    setRenameValue("");
    setUsageCount(null);
    setErrorMsg(null);
  }

  function pickTag(tag: string) {
    setQuery(tag);
    setIsOpen(false);
    resetSelection();
    setSelectedTag(tag);
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
      if (showPanel) pickTag(filteredMatches[highlightedIndex]);
      else {
        // Exact (case-insensitive) match against a known tag lets Enter
        // work without touching the dropdown at all.
        const exact = allTags.find((t) => t.toLowerCase() === query.trim().toLowerCase());
        if (exact) pickTag(exact);
      }
      return;
    }
    if (e.key === "Escape" && showPanel) {
      setIsOpen(false);
    }
  }

  async function startRename() {
    if (!selectedTag) return;
    setMode("renaming");
    setRenameValue(selectedTag);
    setErrorMsg(null);
    setFeedback(null);
  }

  async function startDelete() {
    if (!selectedTag || !selectedAccount) return;
    setMode("deleting");
    setErrorMsg(null);
    setFeedback(null);
    setCheckingUsage(true);
    const count = await getTagUsageCount(selectedAccount.id, selectedTag);
    setUsageCount(count);
    setCheckingUsage(false);
  }

  async function confirmRename() {
    if (!selectedAccount || !selectedTag) return;
    const trimmed = renameValue.trim();
    if (!trimmed) return;
    if (trimmed.toLowerCase() === selectedTag.toLowerCase()) {
      resetSelection();
      setQuery("");
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    const { error, count } = await renameTagEverywhere(selectedAccount.id, selectedTag, trimmed);
    setBusy(false);
    if (error) {
      setErrorMsg("Couldn't rename this tag. Please try again.");
      return;
    }
    setFeedback(`Renamed "${selectedTag}" to "${trimmed}" on ${count} trade${count === 1 ? "" : "s"}/note${count === 1 ? "" : "s"}.`);
    resetSelection();
    setQuery("");
    load();
  }

  async function confirmDelete() {
    if (!selectedAccount || !selectedTag) return;
    setBusy(true);
    setErrorMsg(null);
    const { error, count } = await deleteTagEverywhere(selectedAccount.id, selectedTag);
    setBusy(false);
    if (error) {
      setErrorMsg("Couldn't delete this tag. Please try again.");
      return;
    }
    setFeedback(`Removed "${selectedTag}" from ${count} trade${count === 1 ? "" : "s"}/note${count === 1 ? "" : "s"}.`);
    resetSelection();
    setQuery("");
    load();
  }

  return (
    <SettingsCard
      title="Tag setting"
      description="Rename or delete a tag everywhere it's used across trades and notes."
    >
      <div ref={containerRef} className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            if (selectedTag && e.target.value !== selectedTag) resetSelection();
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={loading ? "Loading tags…" : "Type a tag name…"}
          disabled={loading}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="tag-setting-listbox"
          aria-autocomplete="list"
          className="w-full bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm disabled:opacity-50"
        />

        {showPanel && panelRect &&
          createPortal(
            <ul
              ref={panelRef}
              id="tag-setting-listbox"
              role="listbox"
              style={{ top: panelRect.top, left: panelRect.left, width: panelRect.width }}
              className="fixed z-[100] max-h-48 overflow-auto p-1 bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass"
            >
              {filteredMatches.map((tag, i) => (
                <li
                  key={tag}
                  role="option"
                  aria-selected={i === highlightedIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    pickTag(tag);
                  }}
                  onMouseEnter={() => setHighlightedIndex(i)}
                  className={[
                    "flex items-center rounded-md px-2.5 py-1.5 text-xs cursor-pointer select-none",
                    i === highlightedIndex ? "bg-glow/15 text-glow" : "text-ink-primary",
                  ].join(" ")}
                >
                  {tag}
                </li>
              ))}
            </ul>,
            document.body
          )}
      </div>

      {!loading && allTags.length === 0 && (
        <p className="text-sm text-ink-muted mt-3">
          No tags yet — tags you type on a trade or note will show up here once saved.
        </p>
      )}

      {selectedTag && mode === "idle" && (
        <div className="flex items-center justify-between bg-surface-2 border border-surface-border rounded-md px-3 py-2 mt-3">
          <span className="text-sm">{selectedTag}</span>
          <div className="flex items-center gap-3">
            <button onClick={startRename} className="text-xs text-glow hover:underline">
              Rename
            </button>
            <button onClick={startDelete} className="text-xs text-loss/80 hover:text-loss">
              Delete
            </button>
          </div>
        </div>
      )}

      {selectedTag && mode === "renaming" && (
        <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2.5 mt-3 space-y-2">
          <p className="text-[11px] text-ink-secondary">Rename &quot;{selectedTag}&quot; to:</p>
          <div className="flex items-center gap-2">
            <input
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && confirmRename()}
              autoFocus
              className="flex-1 bg-surface-0 border border-surface-border rounded-md px-3 py-1.5 text-sm"
            />
            <button
              onClick={confirmRename}
              disabled={busy || !renameValue.trim()}
              className="text-xs text-glow font-medium hover:underline disabled:opacity-50"
            >
              {busy ? "Renaming…" : "Confirm"}
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

      {selectedTag && mode === "deleting" && (
        <div className="bg-surface-2 border border-surface-border rounded-md px-3 py-2.5 mt-3 flex items-center gap-3">
          {checkingUsage ? (
            <span className="text-[11px] text-ink-muted">Checking…</span>
          ) : (
            <span className="text-[11px] text-ink-secondary flex-1">
              {usageCount && usageCount > 0
                ? `Delete "${selectedTag}" from ${usageCount} trade${usageCount === 1 ? "" : "s"}/note${usageCount === 1 ? "" : "s"}?`
                : `Delete "${selectedTag}"?`}
            </span>
          )}
          <button
            onClick={confirmDelete}
            disabled={checkingUsage || busy}
            className="text-xs text-loss font-medium hover:underline disabled:opacity-50"
          >
            {busy ? "Removing…" : "Confirm"}
          </button>
          <button
            onClick={resetSelection}
            disabled={busy}
            className="text-xs text-ink-muted hover:text-ink-primary"
          >
            Cancel
          </button>
        </div>
      )}

      {feedback && <p className="text-xs text-gain mt-3">{feedback}</p>}
      {errorMsg && <p className="text-xs text-loss mt-3">{errorMsg}</p>}
    </SettingsCard>
  );
}
