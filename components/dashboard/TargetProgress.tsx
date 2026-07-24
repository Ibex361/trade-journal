"use client";

import Link from "next/link";
import { Drawdown } from "@/lib/metrics";
import Card from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";

function ProgressBar({ pct, colorClass }: { pct: number; colorClass: string }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="h-1.5 w-full bg-surface-2 rounded-full overflow-hidden">
      <div
        className={`h-full rounded-full transition-all duration-slow ease-out ${colorClass}`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function TargetRow({
  label,
  valueLabel,
  targetLabel,
  pct,
  colorClass,
  flagged = false,
}: {
  label: string;
  valueLabel: string;
  targetLabel: string;
  pct: number;
  colorClass: string;
  flagged?: boolean;
}) {
  return (
    <div className={flagged ? "bg-loss/[0.06] border border-loss/20 rounded-md p-2.5 -mx-2.5" : ""}>
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

// In-progress rows carry the signature teal-to-violet glow; flat gain/loss
// colors are reserved for a resolved state (target hit, or over the risk cap).
const GLOW_GRADIENT = "bg-gradient-to-r from-glow to-glow-violet";

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

  // Content-aware flags: which row (if any) is the actual reason this
  // panel deserves a second look, rather than treating every row as
  // equally noteworthy regardless of whether it's fine or a real problem.
  const riskBreached = targetRiskPct != null && avgRiskPct != null && avgRiskPct > targetRiskPct;
  const drawdownDeep = drawdown.maxAmount > 0 && drawdown.currentAmount / drawdown.maxAmount > 0.6;
  const needsAttention = riskBreached || drawdownDeep;

  return (
    <Card
      title="Targets & risk"
      action={
        <div className="flex items-center gap-2 shrink-0">
          {needsAttention && <Badge tone="loss">Needs attention</Badge>}
          <Link href="/settings" className="text-xs text-glow hover:underline whitespace-nowrap">
            Edit targets
          </Link>
        </div>
      }
    >
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
                colorClass={monthlyPnl >= targetMonthlyPnl ? "bg-gain" : GLOW_GRADIENT}
              />
            )}
            {targetMonthlyWinrate != null && (
              <TargetRow
                label="Monthly win rate"
                valueLabel={monthlyWinRate != null ? `${monthlyWinRate.toFixed(0)}%` : "—"}
                targetLabel={`${targetMonthlyWinrate}%`}
                pct={monthlyWinRate != null ? (monthlyWinRate / targetMonthlyWinrate) * 100 : 0}
                colorClass={
                  monthlyWinRate != null && monthlyWinRate >= targetMonthlyWinrate ? "bg-gain" : GLOW_GRADIENT
                }
              />
            )}
            {targetRiskPct != null && (
              <TargetRow
                label="Avg risk per trade"
                valueLabel={avgRiskPct != null ? `${avgRiskPct.toFixed(1)}%` : "—"}
                targetLabel={`${targetRiskPct}% max`}
                pct={avgRiskPct != null ? (avgRiskPct / targetRiskPct) * 100 : 0}
                colorClass={riskBreached ? "bg-loss" : GLOW_GRADIENT}
                flagged={riskBreached}
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
            flagged={drawdownDeep}
          />
        </div>
      </div>
    </Card>
  );
}
