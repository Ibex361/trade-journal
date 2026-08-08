"use client";

import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";

/**
 * Freeform tag entry — type a tag and press Enter/comma (or blur the
 * input) to add it as a chip; click a chip's × to remove it. Replaces the
 * old pattern of toggling pre-set chips sourced from the Settings "tag"
 * dropdown list (TradeFormPanel/NoteEditPanel both used that identically).
 *
 * `suggestions` drives an as-you-type autocomplete panel below the input:
 * already-used tags (from `suggestions`, typically the account's
 * tag_settings list) are filtered by the current draft text and offered
 * as clickable/keyboard-navigable options, so previously-used tags don't
 * need to be retyped from scratch. Dedupe is case-insensitive but
 * preserves the casing of whichever occurrence was typed first.
 */
export default function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = "Add a tag…",
  chipClassName = "bg-surface-2 border-surface-border text-ink-secondary",
  className = "",
}: {
  value: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  chipClassName?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const filteredSuggestions = useMemo(() => {
    if (!suggestions || suggestions.length === 0) return [];
    const trimmed = draft.trim().toLowerCase();
    const alreadyAdded = new Set(value.map((t) => t.toLowerCase()));
    return suggestions
      .filter((s) => !alreadyAdded.has(s.toLowerCase()))
      .filter((s) => (trimmed ? s.toLowerCase().includes(trimmed) : true))
      .slice(0, 8);
  }, [suggestions, draft, value]);

  const showPanel = isOpen && filteredSuggestions.length > 0;

  // Keep the highlighted option in range as the filtered list changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHighlightedIndex(0);
  }, [filteredSuggestions.length, draft]);

  // Close the panel on outside click (blur alone can fire before a click
  // on an option registers, so this covers clicks outside the whole field).
  useEffect(() => {
    if (!showPanel) return;
    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [showPanel]);

  // Splits on commas so pasted or autofilled text like "tag1, tag2, tag3"
  // becomes three chips instead of one literal "tag1, tag2, tag3" tag —
  // the comma key itself is also caught in handleKeyDown for the
  // type-one-at-a-time case, but that alone doesn't cover paste.
  function addTag(raw: string) {
    const parts = raw.split(",").map((t) => t.trim()).filter(Boolean);
    if (parts.length === 0) return;
    const next = [...value];
    for (const part of parts) {
      if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) {
        next.push(part);
      }
    }
    if (next.length !== value.length) onChange(next);
  }

  // Comma handling lives here (onChange), not just in handleKeyDown, so
  // mobile/IME keyboards (Samsung Internet, Gboard with predictive
  // text, etc.) commonly commit a comma as part of a composed input event
  // without ever firing a discrete keydown for it, so a keydown-only
  // check left the draft as a literal "tag1," with the suggestion panel
  // filtering against that whole string (matching nothing) for every tag
  // after the first, until Enter on a comma-less draft finally committed
  // via handleKeyDown. Handling it here instead makes tag-splitting and
  // reopening the suggestion panel work the same way regardless of how
  // the comma was typed.
  function handleDraftChange(next: string) {
    if (next.includes(",")) {
      const lastCommaIndex = next.lastIndexOf(",");
      addTag(next.slice(0, lastCommaIndex));
      const remainder = next.slice(lastCommaIndex + 1);
      setDraft(remainder);
      setIsOpen(true);
      return;
    }
    setDraft(next);
    setIsOpen(true);
  }

  function commitDraft() {
    const trimmed = draft;
    setDraft("");
    setIsOpen(false);
    addTag(trimmed);
  }

  function selectSuggestion(tag: string) {
    setDraft("");
    setIsOpen(false);
    addTag(tag);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (showPanel && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      e.preventDefault();
      const count = filteredSuggestions.length;
      setHighlightedIndex((i) =>
        e.key === "ArrowDown" ? (i + 1) % count : (i - 1 + count) % count
      );
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (showPanel) {
        selectSuggestion(filteredSuggestions[highlightedIndex]);
      } else {
        commitDraft();
      }
      return;
    }
    // Comma is NOT preventDefault'd here — it's left to reach onChange
    // (handleDraftChange), same code path as the mobile/IME/paste cases,
    // so the panel reopens and re-filters for the next tag immediately
    // instead of closing the way commitDraft/selectSuggestion would.
    if (e.key === "," && showPanel) {
      e.preventDefault();
      selectSuggestion(filteredSuggestions[highlightedIndex]);
      return;
    }
    if (e.key === "Escape" && showPanel) {
      setIsOpen(false);
      return;
    }
    // Backspace on an empty draft removes the last chip — mirrors the
    // common chip-input convention (Gmail, Notion, etc.).
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={className} ref={containerRef}>
      <div className="relative">
        <div className="flex flex-wrap items-center gap-2 mt-1 bg-surface-2 border border-surface-border rounded-md px-2 py-1.5 focus-within:border-glow/60 focus-within:ring-2 focus-within:ring-glow/20 transition-colors">
          {value.map((tag) => (
            <span
              key={tag}
              className={`inline-flex items-center gap-1 pl-2.5 pr-1.5 py-0.5 rounded-full text-xs border ${chipClassName}`}
            >
              {tag}
              <button
                type="button"
                onClick={() => removeTag(tag)}
                aria-label={`Remove tag ${tag}`}
                className="text-ink-muted hover:text-ink-primary rounded-full w-4 h-4 flex items-center justify-center leading-none"
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            value={draft}
            onChange={(e) => handleDraftChange(e.target.value)}
            onFocus={() => setIsOpen(true)}
            onKeyDown={handleKeyDown}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData("text");
              if (pasted.includes(",")) {
                e.preventDefault();
                addTag(pasted);
                setDraft("");
              }
              // No comma: let the default paste happen, so it just lands
              // in the draft like normal typing.
            }}
            onBlur={commitDraft}
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listboxId}
            aria-autocomplete="list"
            placeholder={value.length === 0 ? placeholder : ""}
            className="flex-1 min-w-[6rem] bg-transparent text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none py-0.5"
          />
        </div>

        {showPanel && (
          <ul
            id={listboxId}
            role="listbox"
            className="absolute z-[60] left-0 right-0 mt-1 max-h-48 overflow-auto p-1 bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass"
          >
            {filteredSuggestions.map((s, i) => (
              <li
                key={s}
                role="option"
                aria-selected={i === highlightedIndex}
                // onMouseDown (not onClick) so this fires before the
                // input's onBlur commits/clears the draft.
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectSuggestion(s);
                }}
                onMouseEnter={() => setHighlightedIndex(i)}
                className={[
                  "flex items-center rounded-md px-2.5 py-1.5 text-xs cursor-pointer select-none",
                  i === highlightedIndex ? "bg-glow/15 text-glow" : "text-ink-primary",
                ].join(" ")}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
