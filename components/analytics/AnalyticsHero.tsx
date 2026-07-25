"use client";

import { EquityPoint, Expectancy } from "@/lib/metrics";
import Card from "@/components/shared/Card";
import Chip from "@/components/shared/Chip";
import EquityCurveGraph from "@/components/dashboard/EquityCurveGraph";

/**
 * Analytics' hero moment. Total return % is the headline here rather than
 * account balance (Dashboard's job) — it's the one number that actually
 * answers "how did this date range go," normalized so a $50 account and a
 * $50k account read the same way. The curve sits directly beneath it, same
 * "number and the shape that produced it" idea as DashboardHero. Profit
 * factor, expectancy, and max drawdown drop to a chip row: real numbers,
 * but ones you'd check second, not first. Replaces the old AnalyticsStats
 * (four equal-weight cards) + a separately titled "Equity curve" card.
 */
export default function AnalyticsHero({
  totalReturnPct,
  profitFactor,
  expectancy,
  maxDrawdownPct,
  currency,
  points,
}: {
  totalReturnPct: number | null;
  profitFactor: number | null;
  expectancy: Expectancy;
  maxDrawdownPct: number | null;
  currency: string;
  points: EquityPoint[];
}) {
  const returnClass =
    totalReturnPct != null && totalReturnPct > 0
      ? "text-gain"
      : totalReturnPct != null && totalReturnPct < 0
      ? "text-loss"
      : "text-ink-primary";
  const returnSign = totalReturnPct != null && totalReturnPct > 0 ? "+" : "";

  const expectancyClass =
    expectancy.perTrade != null && expectancy.perTrade > 0
      ? "text-gain"
      : expectancy.perTrade != null && expectancy.perTrade < 0
      ? "text-loss"
      : "text-ink-primary";
  const expectancySign = expectancy.perTrade != null && expectancy.perTrade > 0 ? "+" : "";

  return (
    <Card padding="tight" className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-1 pt-1 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-secondary">Total return, this range</p>
          <p className={`font-display text-3xl sm:text-4xl font-medium tracking-tight mt-1 leading-none ${returnClass}`}>
            {totalReturnPct != null ? `${returnSign}${totalReturnPct.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          <Chip label="Profit factor" value={profitFactor != null ? profitFactor.toFixed(2) : "—"} />
          <Chip
            label="Expectancy"
            value={
              expectancy.perTrade != null
                ? `${expectancySign}${expectancy.perTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
                : "—"
            }
            valueClassName={expectancyClass}
          />
          <Chip label="Expectancy (R)" value={expectancy.perR != null ? expectancy.perR.toFixed(2) : "—"} />
          <Chip
            label="Max drawdown"
            value={maxDrawdownPct != null ? `${maxDrawdownPct.toFixed(1)}%` : "—"}
            valueClassName={maxDrawdownPct != null && maxDrawdownPct > 0 ? "text-loss" : "text-ink-primary"}
          />
        </div>
      </div>
      <div className="-mx-2">
        <EquityCurveGraph points={points} currency={currency} height="h-56 sm:h-64" />
      </div>
    </Card>
  );
}
