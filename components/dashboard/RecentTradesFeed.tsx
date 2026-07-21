"use client";

import Link from "next/link";
import { Trade } from "@/lib/trades";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function PnlText({ value }: { value: number }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono text-sm ${color}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

// Assumes `trades` is already ordered most-recent-first (fetchTrades does this).
export default function RecentTradesFeed({ trades }: { trades: Trade[] }) {
  const recent = trades.slice(0, 6);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base font-medium">Recent trades</h2>
        <Link href="/trades" className="text-xs text-brass hover:underline">
          View all
        </Link>
      </div>

      {recent.length === 0 ? (
        <p className="text-ink-muted text-sm">No trades logged yet.</p>
      ) : (
        <div className="divide-y divide-surface-border">
          {recent.map((t) => (
            <div key={t.id} className="flex items-center justify-between py-2.5">
              <div className="flex items-center gap-3">
                <span className="signal-bar h-6" />
                <div>
                  <p className="text-sm font-medium">{t.instrument}</p>
                  <p className="text-xs text-ink-secondary font-mono">
                    {formatDate(t.entry_date)} · <span className="capitalize">{t.direction ?? "—"}</span>
                  </p>
                </div>
              </div>
              <PnlText value={t.pnl} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
