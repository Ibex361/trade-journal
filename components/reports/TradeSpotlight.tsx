"use client";

import { useEffect, useState } from "react";
import { Trade } from "@/lib/trades";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function ScreenshotLightbox({ url, onClose }: { url: string; onClose: () => void }) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 print:hidden">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />
      <img
        src={url}
        alt="Trade chart screenshot"
        className="relative max-w-full max-h-full rounded-lg border border-surface-border"
      />
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

function SpotlightCard({
  label,
  trade,
  accent,
  onOpenScreenshot,
}: {
  label: string;
  trade: Trade | null;
  accent: "gain" | "loss";
  onOpenScreenshot: (url: string) => void;
}) {
  const accentText = accent === "gain" ? "text-gain" : "text-loss";

  if (!trade) {
    return (
      <div className="bg-surface-1 border border-surface-border rounded-card p-5 flex-1 min-w-[260px]">
        <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
        <p className="text-ink-muted text-sm mt-3">No trades this month.</p>
      </div>
    );
  }

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5 flex-1 min-w-[260px] print:break-inside-avoid">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
          <p className="font-display text-base font-medium mt-1">{trade.instrument}</p>
          <p className="text-xs text-ink-secondary font-mono mt-0.5">
            {formatDate(trade.entry_date)} · <span className="capitalize">{trade.direction ?? "—"}</span>
          </p>
        </div>
        {trade.screenshot_url && (
          <button
            onClick={() => onOpenScreenshot(trade.screenshot_url!)}
            className="w-14 h-14 shrink-0 rounded-md overflow-hidden border border-surface-border hover:border-brass/60 transition-colors print:hidden"
            aria-label="View chart screenshot"
          >
            <img src={trade.screenshot_url} alt="" className="w-full h-full object-cover" />
          </button>
        )}
      </div>

      <div className="flex items-baseline gap-4 mt-4">
        <span className={`font-mono text-xl ${accentText}`}>
          {trade.pnl > 0 ? "+" : ""}
          {trade.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })}
        </span>
        {trade.r_multiple !== null && (
          <span className="font-mono text-sm text-ink-secondary">{trade.r_multiple.toFixed(1)}R</span>
        )}
      </div>

      {trade.notes && (
        <p className="text-sm text-ink-secondary mt-3 line-clamp-3">{trade.notes}</p>
      )}
    </div>
  );
}

/**
 * "Highlights" spotlight for the Reports page — the single biggest-winning
 * and biggest-losing trade of the month, each with its screenshot (if any)
 * and notes. Part of Phase 5 Part 3.
 */
export default function TradeSpotlight({ best, worst }: { best: Trade | null; worst: Trade | null }) {
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  return (
    <div>
      <h2 className="font-display text-base font-medium mb-3 print:mt-4">Highlights</h2>
      <div className="flex flex-wrap gap-3">
        <SpotlightCard label="Best trade" trade={best} accent="gain" onOpenScreenshot={setLightboxUrl} />
        <SpotlightCard label="Worst trade" trade={worst} accent="loss" onOpenScreenshot={setLightboxUrl} />
      </div>
      {lightboxUrl && <ScreenshotLightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />}
    </div>
  );
}
