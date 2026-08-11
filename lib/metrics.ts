// Shared calculation logic for trade metrics.
// Dashboard, Trades, Analytics, and Reports should all import from
// here so the numbers can never drift apart between pages.
//
// Implementation lives in lib/metrics/{pnl,equity,breakdowns,time}.ts,
// split out for navigability (this file was previously ~1300 lines).
// This file re-exports everything so existing `@/lib/metrics` imports
// across the app keep working unchanged — no consumer file needed to
// change as part of the split.
//
//   pnl.ts        — per-trade math (P&L, R-multiple) + aggregate summaries
//                    (summarizeTrades, expectancy, profit factor, avg risk %)
//   equity.ts      — equity curve, streak, drawdown, date-range scoping
//   breakdowns.ts  — group-by-X summaries (strategy, dimension, exit reason,
//                    SL management, R-multiple distribution, planned vs.
//                    realized R, tag frequency)
//   time.ts        — calendar/clock-time views (period buckets, time-of-day,
//                    holding time, monthly calendar, best/worst trade & day)

export * from "./metrics/pnl";
export * from "./metrics/equity";
export * from "./metrics/breakdowns";
export * from "./metrics/time";
