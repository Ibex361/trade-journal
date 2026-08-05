"use client";

import { useEffect, useRef, useState } from "react";
import Button from "@/components/shared/Button";

/**
 * A styled stand-in for window.prompt("Link URL") — same job (collect a
 * URL, allow clearing an existing link), rendered in the app's own
 * glass/blur language instead of the browser's native, unstyleable popup.
 * Mirrors ConfirmDialog's structure/z-index/overlay so it sits consistently
 * with the rest of the app's modals.
 */
export default function LinkDialog({
  open,
  initialUrl,
  onSubmit,
  onCancel,
}: {
  open: boolean;
  initialUrl?: string;
  onSubmit: (url: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState(initialUrl ?? "https://");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setValue(initialUrl ?? "https://");
    }
  }, [open, initialUrl]);

  useEffect(() => {
    if (open) {
      // Match native prompt() behavior: focus + select the text immediately.
      const id = requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });
      return () => cancelAnimationFrame(id);
    }
  }, [open]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(value.trim());
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 motion-safe:animate-fade-in" onClick={onCancel} />
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-sm bg-surface-solid backdrop-blur-xl border border-surface-border rounded-panel shadow-glass p-6 motion-safe:animate-scale-in"
      >
        <h3 className="font-display text-base font-medium text-ink-primary">Link URL</h3>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onCancel();
          }}
          placeholder="https://"
          className="mt-3 w-full bg-surface-2 border border-surface-border rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-glow/50 focus:ring-1 focus:ring-glow/50"
        />
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" size="sm">
            OK
          </Button>
        </div>
      </form>
    </div>
  );
}
