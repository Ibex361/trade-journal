// Core per-trade and aggregate P&L calculations — the foundation every
// other metrics module builds on (summarizeTrades in particular is reused
// everywhere breakdowns/time buckets need win-rate + avgR for a group).

import { Direction, Trade } from "../trades";

/**
 * P&L = (exit - entry) * size for a long, or (entry - exit) * size for a short.
 * "size" is treated as a plain number of units (not lots), so this is a
 * direct price-difference calculation with no pip/contract conversion.
 * Returns null if any required input is missing.
 */
export function calculatePnl(
  direction: Direction | null,
  entryPrice: number | null,
  exitPrice: number | null,
  size: number | null
): number | null {
  if (entryPrice == null || exitPrice == null || size == null) return null;
  if (Number.isNaN(entryPrice) || Number.isNaN(exitPrice) || Number.isNaN(size)) return null;

  const priceDiff = direction === "short" ? entryPrice - exitPrice : exitPrice - entryPrice;
  return priceDiff * size;
}

/**
 * R-multiple = reward / risk, where risk is the distance from entry to
 * stop loss, and reward is the distance from entry to exit (direction-aware).
 * Returns null if any required input is missing or risk is zero.
 */
export function calculateRMultiple(
  direction: Direction | null,
  entryPrice: number | null,
  exitPrice: number | null,
  stopLossPrice: number | null
): number | null {
  if (entryPrice == null || exitPrice == null || stopLossPrice == null) return null;
  if (Number.isNaN(entryPrice) || Number.isNaN(exitPrice) || Number.isNaN(stopLossPrice)) return null;

  const risk = Math.abs(entryPrice - stopLossPrice);
  if (risk === 0) return null;

  const reward = direction === "short" ? entryPrice - exitPrice : exitPrice - entryPrice;
  return reward / risk;
}

/**
 * Planned R-multiple = reward / risk using the take-profit price as the
 * reward target instead of the actual exit price — i.e. the R the trade was
 * set up to capture before it got managed. Same direction-aware risk
 * convention as calculateRMultiple (risk = |entry - stop|). Returns null if
 * any required input is missing or risk is zero — this is what makes a
 * trade "unplanned" for the planned-vs-realized comparison in breakdowns.ts.
 */
export function calculatePlannedRMultiple(
  direction: Direction | null,
  entryPrice: number | null,
  stopLossPrice: number | null,
  takeProfitPrice: number | null
): number | null {
  if (entryPrice == null || stopLossPrice == null || takeProfitPrice == null) return null;
  if (Number.isNaN(entryPrice) || Number.isNaN(stopLossPrice) || Number.isNaN(takeProfitPrice)) return null;

  const risk = Math.abs(entryPrice - stopLossPrice);
  if (risk === 0) return null;

  const reward = direction === "short" ? entryPrice - takeProfitPrice : takeProfitPrice - entryPrice;
  return reward / risk;
}

export type TradeSummary = {
  count: number;
  totalPnl: number;
  /**
   * Win rate as a 0-100 percentage, counting breakeven trades (pnl === 0)
   * against you: wins ÷ ALL trades. This is the app's default convention —
   * see WinRateModeContext. Null if there are no trades.
   */
  winRateStrict: number | null;
  /**
   * Win rate as a 0-100 percentage across only "decided" trades: wins ÷
   * (wins + losses), with breakeven trades excluded from both sides. Kept
   * alongside winRateStrict so the user can switch conventions without any
   * numbers disagreeing. Null if there are no decided trades.
   */
  winRateDecided: number | null;
  /** Average R-multiple across trades that have one recorded. Null if there are none. */
  avgR: number | null;
  wins: number;
  losses: number;
  breakeven: number;
};

/**
 * Aggregate stats for a set of trades (e.g. the currently filtered list on
 * the Trades page). Dashboard, Analytics, and Reports should reuse this
 * same function for any equivalent figure so the numbers never drift.
 *
 * Single pass over `trades` rather than chained .reduce/.filter/.map calls —
 * this runs 15+ times per Analytics render alone (once for the range total,
 * once per group in every breakdown), so collapsing ~5 scans into 1 is a
 * real constant-factor win at that call volume, even though each individual
 * call was already O(n).
 */
export function summarizeTrades(trades: Trade[]): TradeSummary {
  const count = trades.length;
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;
  let rSum = 0;
  let rCount = 0;

  for (const t of trades) {
    totalPnl += t.pnl;
    if (t.pnl > 0) wins++;
    else if (t.pnl < 0) losses++;
    if (t.r_multiple != null && !Number.isNaN(t.r_multiple)) {
      rSum += t.r_multiple;
      rCount++;
    }
  }

  const breakeven = count - wins - losses;
  const decided = wins + losses;
  const winRateStrict = count > 0 ? (wins / count) * 100 : null;
  const winRateDecided = decided > 0 ? (wins / decided) * 100 : null;
  const avgR = rCount > 0 ? rSum / rCount : null;

  return { count, totalPnl, winRateStrict, winRateDecided, avgR, wins, losses, breakeven };
}

/** Picks the right winRate figure off a TradeSummary/BreakdownGroup-shaped object for the given mode. */
export function pickWinRate(
  summary: { winRateStrict: number | null; winRateDecided: number | null },
  mode: "strict" | "decided"
): number | null {
  return mode === "strict" ? summary.winRateStrict : summary.winRateDecided;
}

/**
 * Profit factor = gross profit / gross loss. Null if there are no losing
 * trades to divide by (undefined ratio) or no trades at all.
 */
export function getProfitFactor(trades: Trade[]): number | null {
  let grossProfit = 0;
  let grossLoss = 0;
  for (const t of trades) {
    if (t.pnl > 0) grossProfit += t.pnl;
    else if (t.pnl < 0) grossLoss += t.pnl;
  }
  grossLoss = Math.abs(grossLoss);
  if (grossLoss === 0) return null;
  return grossProfit / grossLoss;
}

export type Expectancy = {
  /** Average P&L per trade, in account currency. */
  perTrade: number | null;
  /** Average R-multiple per trade, across trades that have one recorded. */
  perR: number | null;
};

/** Average result per trade — both in currency and in R, so either lens is available. */
export function getExpectancy(trades: Trade[]): Expectancy {
  if (trades.length === 0) return { perTrade: null, perR: null };
  let pnlSum = 0;
  let rSum = 0;
  let rCount = 0;
  for (const t of trades) {
    pnlSum += t.pnl;
    if (t.r_multiple != null && !Number.isNaN(t.r_multiple)) {
      rSum += t.r_multiple;
      rCount++;
    }
  }
  const perTrade = pnlSum / trades.length;
  const perR = rCount > 0 ? rSum / rCount : null;
  return { perTrade, perR };
}

/**
 * Total P&L across the trades as a percentage of `baseBalance`. For a
 * range-scoped figure (e.g. "30-day return"), pass the equity curve's
 * balance at the START of that range — not the account's all-time
 * starting_balance — or growth/drawdown since inception will distort the
 * period return. Callers should derive baseBalance from the same equity
 * curve object used to draw the chart (its first point), so the two can
 * never disagree.
 */
export function getTotalReturnPct(trades: Trade[], baseBalance: number): number | null {
  if (baseBalance <= 0) return null;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  return (totalPnl / baseBalance) * 100;
}

/**
 * Average risk per trade as a percentage of account balance, i.e.
 * |entry - stop| * size / balance-at-that-trade * 100, averaged across
 * trades that have all three inputs recorded. Used to compare against a
 * target risk-per-trade ceiling set in Settings.
 *
 * Each trade is measured against the balance it actually had BEFORE that
 * trade (via balanceBeforeByTradeId, from getBalanceBeforeTrade in
 * equity.ts) rather than today's balance — a trade placed early in the
 * month shouldn't have its risk % distorted by wins or losses that
 * happened after it.
 */
export function getAvgRiskPct(trades: Trade[], balanceBeforeByTradeId: Map<string, number>): number | null {
  const pcts: number[] = [];
  for (const t of trades) {
    if (t.entry_price == null || t.stop_loss_price == null || t.size == null) continue;
    const balance = balanceBeforeByTradeId.get(t.id);
    if (balance == null || balance <= 0) continue;
    pcts.push((Math.abs(t.entry_price - t.stop_loss_price) * t.size) / balance * 100);
  }
  if (pcts.length === 0) return null;
  return pcts.reduce((s, v) => s + v, 0) / pcts.length;
}
