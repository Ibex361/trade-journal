"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Freeform tag entry — type a tag and press Enter/comma (or blur the
 * input) to add it as a chip; click a chip's × to remove it. Replaces the
 * old pattern of toggling pre-set chips sourced from the Settings "tag"
 * dropdown list (TradeFormPanel/NoteEditPanel both used that identically).
 *
 * `suggestions` is accepted but not yet rendered as a dropdown — reserved
 * for a later autocomplete pass so call sites don't need to change when
 * that lands. Dedupe is case-insensitive but preserves the casing of
 * whichever occurrence was typed first.
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

  function commitDraft() {
    const trimmed = draft.trim();
    setDraft("");
    if (!trimmed) return;
    if (value.some((t) => t.toLowerCase() === trimmed.toLowerCase())) return;
    onChange([...value, trimmed]);
  }

  function removeTag(tag: string) {
    onChange(value.filter((t) => t !== tag));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commitDraft();
      return;
    }
    // Backspace on an empty draft removes the last chip — mirrors the
    // common chip-input convention (Gmail, Notion, etc.).
    if (e.key === "Backspace" && draft === "" && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className={className}>
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
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[6rem] bg-transparent text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none py-0.5"
        />
      </div>
    </div>
  );
}
