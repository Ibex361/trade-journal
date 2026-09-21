"use client";

import NewBacktestForm from "@/components/backtests/NewBacktestForm";
import BacktestRunsList from "@/components/backtests/BacktestRunsList";

export default function BacktestsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Backtests</h1>
        <p className="text-ink-secondary text-sm mt-1">
          Run a Backtrader strategy against Exness tick history and see Backtrader&apos;s own results.
        </p>
      </div>
      <NewBacktestForm />
      <BacktestRunsList />
    </div>
  );
}
