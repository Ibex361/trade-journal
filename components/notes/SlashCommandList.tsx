"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import type { SlashCommandItem } from "./slashCommandItems";

/**
 * Notes/diary — Phase 2 part 3.
 *
 * Popup rendered inside a tippy instance by slashCommand.ts's suggestion
 * `render()`. Exposes onKeyDown via a ref so the Tiptap Suggestion plugin
 * can forward arrow/enter key events from the editor into this list —
 * the editor keeps focus the whole time, this component never receives it.
 */

type SlashCommandListProps = {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
};

export type SlashCommandListHandle = {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
};

const SlashCommandList = forwardRef<SlashCommandListHandle, SlashCommandListProps>(
  ({ items, command }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    function selectItem(index: number) {
      const item = items[index];
      if (item) command(item);
    }

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((i) => (i + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((i) => (i + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) {
      return (
        <div className="bg-surface-solid backdrop-blur-md border border-surface-border rounded-card shadow-glass px-3 py-2.5 text-sm text-ink-muted w-64">
          No matching blocks
        </div>
      );
    }

    return (
      <div className="bg-surface-solid backdrop-blur-md border border-surface-border rounded-card shadow-glass overflow-y-auto py-1 w-64 max-h-80">
        {items.map((item, index) => (
          <button
            key={item.title}
            type="button"
            onClick={() => selectItem(index)}
            onMouseEnter={() => setSelectedIndex(index)}
            className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors duration-fast ${
              index === selectedIndex ? "bg-surface-2 text-glow" : "text-ink-primary"
            }`}
          >
            <span
              className={`shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${
                index === selectedIndex ? "bg-glow/15 text-glow" : "bg-surface-2 text-ink-secondary"
              }`}
            >
              {item.icon}
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-medium truncate">{item.title}</span>
              <span className="block text-xs text-ink-muted truncate">{item.description}</span>
            </span>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandList.displayName = "SlashCommandList";

export default SlashCommandList;
