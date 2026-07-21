"use client";

import Link from "next/link";

function ProgressBar({
  pct,
  colorClass,
}: {
  pct: number;
  colorClass: string;
}) {
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
  over,
}: {
  label: string;
  valueLabel: string;
  targetLabel: string;
  pct: number;
  over: boolean;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-ink-secondary">{label}</span>
        <span className="text-xs font-mono text-ink-secondary">
          <span className={over ? "text-loss" : "text-ink-primary"}>{valueLabel}</span> / {targetLabel}
        </span>
      </div>
      <ProgressBar pct={pct} colorClass={over ? "bg-loss" : "bg-brass"} />
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
}: {
  targetMonthlyPnl: number | null;
  targetMonthlyWinrate: number | null;
  targetRiskPct: number | null;
  monthlyPnl: number;
  monthlyWinRate: number | null;
  avgRiskPct: number | null;
  currency: string;
}) {
  const hasAnyTarget = targetMonthlyPnl != null || targetMonthlyWinrate != null || targetRiskPct != null;

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-medium">This month's targets</h2>
        <Link href="/settings" className="text-xs text-brass hover:underline">
          Edit targets
        </Link>
      </div>

      {!hasAnyTarget ? (
        <p className="text-ink-muted text-sm">
          No targets set yet. Add them in Settings to track progress here.
        </p>
      ) : (
        <div className="space-y-4">
          {targetMonthlyPnl != null && (
            <TargetRow
              label="Monthly P&L"
              valueLabel={`${monthlyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`}
              targetLabel={`${targetMonthlyPnl.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`}
              pct={targetMonthlyPnl > 0 ? (monthlyPnl / targetMonthlyPnl) * 100 : 0}
              over={false}
            />
          )}
          {targetMonthlyWinrate != null && (
            <TargetRow
              label="Monthly win rate"
              valueLabel={monthlyWinRate != null ? `${monthlyWinRate.toFixed(0)}%` : "—"}
              targetLabel={`${targetMonthlyWinrate}%`}
              pct={monthlyWinRate != null ? (monthlyWinRate / targetMonthlyWinrate) * 100 : 0}
              over={false}
            />
          )}
          {targetRiskPct != null && (
            <TargetRow
              label="Avg risk per trade"
              valueLabel={avgRiskPct != null ? `${avgRiskPct.toFixed(1)}%` : "—"}
              targetLabel={`${targetRiskPct}% max`}
              pct={avgRiskPct != null ? (avgRiskPct / targetRiskPct) * 100 : 0}
              over={avgRiskPct != null && avgRiskPct > targetRiskPct}
            />
          )}
        </div>
      )}
    </div>
  );
}
