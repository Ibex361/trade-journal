"use client";

import { Drawdown } from "@/lib/metrics";

export default function DrawdownStrip({
  drawdown,
  currency,
}: {
  drawdown: Drawdown;
  currency: string;
}) {
  const inDrawdown = drawdown.currentAmount > 0;
  const barPct = drawdown.maxPct > 0 ? Math.min(100, (drawdown.currentPct / drawdown.maxPct) * 100) : 0;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-base font-medium">Drawdown</h2>
        <span className="text-xs text-ink-secondary">
          Max: <span className="font-mono text-loss">
            {drawdown.maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} {currency}
          </span>{" "}
          ({drawdown.maxPct.toFixed(1)}%)
        </span>
      </div>

      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-ink-secondary">Current</span>
        <span className={`text-xs font-mono ${inDrawdown ? "text-loss" : "text-ink-secondary"}`}>
          {inDrawdown
            ? `-${drawdown.currentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency} (${drawdown.currentPct.toFixed(1)}%)`
            : "At peak"}
        </span>
      </div>
      <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
        <div className="h-full rounded-full bg-loss" style={{ width: `${inDrawdown ? barPct : 0}%` }} />
      </div>
    </div>
  );
}
