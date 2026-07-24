"use client";

import Link from "next/link";
import { Trade } from "@/lib/trades";
import Card from "@/components/shared/Card";

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
  const maxAbsPnl = recent.reduce((max, t) => Math.max(max, Math.abs(t.pnl)), 0);

  return (
    <Card
      title="Recent trades"
      action={
        <Link href="/trades" className="text-xs text-glow hover:underline">
          View all
        </Link>
      }
    >
      {recent.length === 0 ? (
        <p className="text-ink-muted text-sm">No trades logged yet.</p>
      ) : (
        <div className="divide-y divide-surface-border">
          {recent.map((t) => {
            const pct = maxAbsPnl > 0 ? Math.max(4, (Math.abs(t.pnl) / maxAbsPnl) * 100) : 0;
            return (
              <div key={t.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-3">
                  {/* Content-aware: colored by outcome, not a static
                      decorative gradient, so it actually signals win/loss
                      like the equivalent marker on Trades does. */}
                  <span
                    className="w-1 h-6 rounded-full shrink-0"
                    style={{ background: t.pnl > 0 ? "var(--glow)" : t.pnl < 0 ? "var(--loss)" : "var(--ink-3)" }}
                  />
                  <div>
                    <p className="text-sm font-medium">{t.instrument}</p>
                    <p className="text-xs text-ink-secondary font-mono">
                      {formatDate(t.entry_date)} · <span className="capitalize">{t.direction ?? "—"}</span>
                    </p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <PnlText value={t.pnl} />
                  <div className="w-12 h-1 rounded-full bg-surface-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${t.pnl > 0 ? "bg-gain" : t.pnl < 0 ? "bg-loss" : "bg-ink-muted"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
