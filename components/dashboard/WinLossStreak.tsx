"use client";

import { Streak } from "@/lib/metrics";

export default function WinLossStreak({ streak }: { streak: Streak }) {
  const isWin = streak.type === "win";
  const isLoss = streak.type === "loss";

  const colorClass = isWin ? "text-gain" : isLoss ? "text-loss" : "text-ink-primary";
  const barClass = isWin ? "bg-gain" : isLoss ? "bg-loss" : "bg-surface-border";
  const label = isWin ? "Win streak" : isLoss ? "Loss streak" : "No streak";

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card px-4 py-3 flex-1 min-w-[130px]">
      <p className="text-[11px] uppercase tracking-wide text-ink-secondary">{label}</p>
      <div className="flex items-end gap-2 mt-0.5">
        <p className={`font-mono text-lg ${colorClass}`}>{streak.count > 0 ? streak.count : "—"}</p>
        {streak.count > 0 && (
          <div className="flex gap-0.5 mb-1.5">
            {Array.from({ length: Math.min(streak.count, 8) }).map((_, i) => (
              <span key={i} className={`w-1.5 h-1.5 rounded-full ${barClass}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
