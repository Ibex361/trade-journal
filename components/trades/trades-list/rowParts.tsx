"use client";

import { useEffect } from "react";
import Image from "next/image";
import { Trade } from "@/lib/trades";
import imagekitLoader, { isRemoteScreenshotUrl } from "@/lib/imagekitLoader";

export type SortColumn = "entry_date" | "instrument" | "pnl" | "r_multiple";
export type SortState = { column: SortColumn; direction: "asc" | "desc" };

// Shared row-level props for the memoized Desktop/Mobile row components.
// Every callback here is expected to have a STABLE identity from the parent
// (via useCallback) — that's what lets React.memo actually skip re-rendering
// rows untouched by whatever triggered the parent re-render (typing in the
// filter bar, selecting a different row, opening the screenshot lightbox).
export type RowCallbacks = {
  onEdit: (trade: Trade) => void;
  onDuplicate: (trade: Trade) => void;
  // Opens the shared confirm dialog for this row; the actual delete only
  // fires once the user confirms there (see TradesList's requestDelete).
  onRequestDelete: (id: string) => void;
  onOpenScreenshot: (url: string) => void;
  onRowClick: (e: React.MouseEvent, id: string) => void;
  onCheckboxClick: (e: React.MouseEvent<HTMLInputElement>, id: string, index: number) => void;
  onPointerDown: (id: string, target: EventTarget) => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
  onContextMenuGuard: (e: React.MouseEvent) => void;
};

export type RowProps = RowCallbacks & {
  trade: Trade;
  index: number;
  selectionMode: boolean;
  isSelected: boolean;
  isBest: boolean;
  isWorst: boolean;
  maxAbsPnl: number;
};

export function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// entry_time comes back from Postgres as "HH:MM:SS" (or "HH:MM" for a
// freshly-saved value) — routed through a Date only so toLocaleTimeString
// can localize it (12h vs 24h) the same way formatDate does for dates.
export function formatTime(t: string) {
  const [h, m] = t.split(":");
  return new Date(2000, 0, 1, Number(h), Number(m)).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PnlText({ value, className = "" }: { value: number; className?: string }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono ${color} ${className}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

// Opens the shared ConfirmDialog (mounted once by the list, not once per
// row — see TradesList's requestDelete/confirmingId) rather than swapping
// this button for a "Confirm" label in the same screen position. The old
// in-place swap put the confirm target where "Delete" used to be, which on
// touch made a fast double-tap (fat-finger, or double-tap-to-zoom muscle
// memory) land on Delete then Confirm before the user could register the
// label had changed — with no undo, since deleteTrade is a hard DB delete.
// A modal breaks that: it's a different part of the screen, it needs a
// deliberate tap on the dialog's own Confirm button, and it matches the
// ConfirmDialog pattern TradeFormPanel/NoteEditPanel already use for their
// destructive actions instead of a second, weaker pattern just for rows.
export function DeleteButton({ onRequestDelete }: { onRequestDelete: () => void }) {
  return (
    <button
      onClick={onRequestDelete}
      className="text-xs text-ink-muted hover:text-loss"
    >
      Delete
    </button>
  );
}

export function RulesBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-ink-muted text-xs">—</span>;
  return (
    <span
      className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold leading-none ${
        value ? "bg-gain/15 text-gain" : "bg-loss/15 text-loss"
      }`}
      title={value ? "Rules followed" : "Rules not followed"}
      aria-label={value ? "Rules followed" : "Rules not followed"}
    >
      {value ? "✓" : "✕"}
    </span>
  );
}

export function ScreenshotThumb({ url, onOpen }: { url: string | null; onOpen: () => void }) {
  if (!url) return <span className="text-ink-muted text-xs">—</span>;
  return (
    <button
      onClick={onOpen}
      className="relative w-9 h-9 rounded-md overflow-hidden border border-surface-border hover:border-glow/60 transition-colors"
      aria-label="View chart screenshot"
    >
      <Image loader={imagekitLoader} src={url} alt="" fill className="object-cover" sizes="36px" />
    </button>
  );
}

export function ScreenshotLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-black/80 motion-safe:animate-fade-in" onClick={onClose} />
      <div className="relative w-[90vw] h-[85vh] max-w-3xl motion-safe:animate-scale-in">
        {isRemoteScreenshotUrl(url) ? (
          <Image
            loader={imagekitLoader}
            src={url}
            alt="Trade chart screenshot"
            fill
            className="object-contain rounded-lg border border-surface-border"
            sizes="90vw"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- local blob:/data: preview, not an ImageKit URL the loader/optimizer can handle.
          <img
            src={url}
            alt="Trade chart screenshot"
            className="w-full h-full object-contain rounded-lg border border-surface-border"
          />
        )}
      </div>
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

export function SortHeader({
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
      <span className={`text-glow ${active ? "" : "opacity-0"}`}>
        {sort.direction === "asc" ? "↑" : "↓"}
      </span>
    </button>
  );
}
