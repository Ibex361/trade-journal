"use client";

import Link from "next/link";
import { Drawdown } from "@/lib/metrics";

function ProgressBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${colorClass}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

function TargetRow({
  label,
  valueLabel,
  targetLabel,
  pct,
  colorClass,
}: {
  label: string;
  valueLabel: string;
  targetLabel: string;
  pct: number;
  colorClass: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-ink-secondary">{label}</span>
        <span className="text-xs font-mono">
          <span className="text-ink-primary">{valueLabel}</span>
          <span className="text-ink-muted"> / {targetLabel}</span>
        </span>
      </div>
      <ProgressBar pct={pct} colorClass={colorClass} />
    </div>
  );
}

export default function TargetProgress({
  targetMonthlyPnl,
  targetMonthlyWinrate,
  targetRiskPct,
  monthlyPnl,
  monthlyWinRate,
  avgRiskPct,
  currency,
  drawdown,
}: {
  targetMonthlyPnl: number | null;
  targetMonthlyWinrate: number | null;
  targetRiskPct: number | null;
  monthlyPnl: number;
  monthlyWinRate: number | null;
  avgRiskPct: number | null;
  currency: string;
  drawdown: Drawdown;
}) {
  const hasAnyTarget = targetMonthlyPnl != null || targetMonthlyWinrate != null || targetRiskPct != null;
  const inDrawdown = drawdown.currentAmount > 0;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-medium">Targets &amp; risk</h2>
        <Link href="/settings" className="text-xs text-brass hover:underline">
          Edit targets
        </Link>
      </div>

      <div className="space-y-4">
        {!hasAnyTarget ? (
          <p className="text-ink-muted text-sm">
            No targets set yet — add them in Settings to track progress here.
          </p>
        ) : (
          <>
            {targetMonthlyPnl != null && (
              <TargetRow
                label="Monthly P&L"
                valueLabel={`${monthlyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`}
                targetLabel={`${targetMonthlyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`}
                pct={targetMonthlyPnl > 0 ? (monthlyPnl / targetMonthlyPnl) * 100 : 0}
                colorClass={monthlyPnl >= targetMonthlyPnl ? "bg-gain" : "bg-brass"}
              />
            )}
            {targetMonthlyWinrate != null && (
              <TargetRow
                label="Monthly win rate"
                valueLabel={monthlyWinRate != null ? `${monthlyWinRate.toFixed(0)}%` : "—"}
                targetLabel={`${targetMonthlyWinrate}%`}
                pct={monthlyWinRate != null ? (monthlyWinRate / targetMonthlyWinrate) * 100 : 0}
                colorClass={
                  monthlyWinRate != null && monthlyWinRate >= targetMonthlyWinrate ? "bg-gain" : "bg-brass"
                }
              />
            )}
            {targetRiskPct != null && (
              <TargetRow
                label="Avg risk per trade"
                valueLabel={avgRiskPct != null ? `${avgRiskPct.toFixed(1)}%` : "—"}
                targetLabel={`${targetRiskPct}% max`}
                pct={avgRiskPct != null ? (avgRiskPct / targetRiskPct) * 100 : 0}
                colorClass={avgRiskPct != null && avgRiskPct > targetRiskPct ? "bg-loss" : "bg-brass"}
              />
            )}
          </>
        )}

        <div className={hasAnyTarget ? "pt-4 border-t border-surface-border" : ""}>
          <TargetRow
            label="Drawdown from peak"
            valueLabel={
              inDrawdown
                ? `-${drawdown.currentAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
                : "At peak"
            }
            targetLabel={`max ${drawdown.maxAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`}
            pct={drawdown.maxAmount > 0 ? (drawdown.currentAmount / drawdown.maxAmount) * 100 : 0}
            colorClass="bg-loss"
          />
        </div>
      </div>
    </div>
  );
}
