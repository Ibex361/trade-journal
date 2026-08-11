"use client";

import { EquityPoint, Streak } from "@/lib/metrics";
import Card from "@/components/shared/Card";
import EquityCurveGraph from "@/components/dashboard/EquityCurveGraph";

function DeltaBadge({ value, currency }: { value: number; currency: string }) {
  const positive = value >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 font-mono text-sm px-2.5 py-1 rounded-full ${
        positive ? "bg-gain/10 text-gain" : "bg-loss/10 text-loss"
      }`}
    >
      <svg
        width="10"
        height="10"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={positive ? "" : "rotate-180"}
      >
        <path d="M12 19V5M5 12l7-7 7 7" />
      </svg>
      {positive ? "+" : ""}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
    </span>
  );
}

/**
 * The Dashboard's hero moment: the account balance and its equity curve as
 * one continuous panel instead of a stat card sitting above an unrelated
 * chart card. The balance is the headline; total P&L is the delta badge
 * next to it; the streak (when there is one) sits as a quiet aside. The
 * curve itself starts almost immediately below, so the number and the
 * shape that produced it read as a single idea.
 */
export default function DashboardHero({
  accountBalance,
  totalPnl,
  currency,
  points,
  streak,
}: {
  accountBalance: number;
  totalPnl: number;
  currency: string;
  points: EquityPoint[];
  streak: Streak;
}) {
  const streakClass = streak.type === "win" ? "text-gain" : streak.type === "loss" ? "text-loss" : "text-ink-muted";

  return (
    <Card padding="tight" className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 px-1 pt-1 pb-4">
        <div>
          <p className="text-[11px] uppercase tracking-wide text-ink-secondary">Account balance</p>
          <p className="font-mono text-3xl sm:text-4xl font-medium tracking-tight mt-1 leading-none">
            {accountBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            <span className="text-base sm:text-lg text-ink-secondary ml-1.5">{currency}</span>
          </p>
        </div>
        <div className="flex items-center gap-3">
          {streak.count > 0 && (
            <span className={`text-xs font-mono ${streakClass}`}>
              {streak.count} {streak.type === "win" ? "win" : "loss"} streak
            </span>
          )}
          <DeltaBadge value={totalPnl} currency={currency} />
        </div>
      </div>
      <div className="-mx-2">
        <EquityCurveGraph points={points} currency={currency} height="h-56 sm:h-64" />
      </div>
    </Card>
  );
}
