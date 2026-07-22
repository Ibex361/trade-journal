"use client";

import { Expectancy } from "@/lib/metrics";
import StatCard from "@/components/shared/StatCard";

export default function AnalyticsStats({
  totalReturnPct,
  profitFactor,
  expectancy,
  maxDrawdownPct,
  currency,
}: {
  totalReturnPct: number | null;
  profitFactor: number | null;
  expectancy: Expectancy;
  maxDrawdownPct: number | null;
  currency: string;
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
    <div className="flex flex-wrap gap-3">
      <StatCard
        label="Total return"
        value={totalReturnPct != null ? `${returnSign}${totalReturnPct.toFixed(1)}%` : "—"}
        valueClassName={returnClass}
      />
      <StatCard label="Profit factor" value={profitFactor != null ? profitFactor.toFixed(2) : "—"} />
      <StatCard
        label="Expectancy"
        value={
          expectancy.perTrade != null
            ? `${expectancySign}${expectancy.perTrade.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency}`
            : "—"
        }
        valueClassName={expectancyClass}
      />
      <StatCard label="Expectancy (R)" value={expectancy.perR != null ? expectancy.perR.toFixed(2) : "—"} />
      <StatCard
        label="Max drawdown"
        value={maxDrawdownPct != null ? `${maxDrawdownPct.toFixed(1)}%` : "—"}
        valueClassName={maxDrawdownPct != null && maxDrawdownPct > 0 ? "text-loss" : "text-ink-primary"}
        hint={maxDrawdownPct == null ? "Peak balance was $0 or below — % undefined" : undefined}
      />
    </div>
  );
}
