"use client";

import { useState, type KeyboardEvent } from "react";

/**
 * Lightweight tag editor for notes — type a tag, press Enter or comma to add.
 * Suggestions come from tags already used on this account's notes.
 */
export default function NoteTagsInput({
  tags,
  suggestions = [],
  onChange,
}: {
  tags: string[];
  suggestions?: string[];
  onChange: (next: string[]) => void;
}) {
  const [input, setInput] = useState("");

  function normalize(raw: string) {
    return raw.trim().replace(/^#/, "").toLowerCase();
  }

  function add(raw: string) {
    const t = normalize(raw);
    if (!t) return;
    if (tags.includes(t)) {
      setInput("");
      return;
    }
    onChange([...tags, t]);
    setInput("");
  }

  function remove(t: string) {
    onChange(tags.filter((x) => x !== t));
  }

  function onKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      add(input);
    } else if (e.key === "Backspace" && !input && tags.length) {
      remove(tags[tags.length - 1]);
    }
  }

  const filtered = suggestions
    .filter((s) => !tags.includes(s) && s.includes(normalize(input)))
    .slice(0, 6);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5 min-h-[2.25rem] px-2.5 py-1.5 rounded-lg bg-surface-2 border border-surface-border focus-within:border-glow/40">
        {tags.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => remove(t)}
            className="inline-flex items-center gap-1 text-[11px] font-medium rounded-full px-2 py-0.5 bg-glow/10 text-glow border border-glow/25 hover:bg-loss/15 hover:text-loss hover:border-loss/30 transition-colors duration-fast"
            title="Remove tag"
          >
            #{t}
            <span aria-hidden className="opacity-60">
              ×
            </span>
          </button>
        ))}
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={() => {
            if (input.trim()) add(input);
          }}
          placeholder={tags.length ? "Add tag…" : "Tags — type and press Enter"}
          className="flex-1 min-w-[7rem] bg-transparent text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none py-0.5"
        />
      </div>
      {input && filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                add(s);
              }}
              className="text-[11px] text-ink-secondary hover:text-glow border border-surface-border rounded-full px-2 py-0.5 hover:border-glow/40 transition-colors duration-fast"
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
