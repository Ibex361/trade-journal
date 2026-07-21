// Shared calculation logic for trade metrics.
// Dashboard, Trades, Analytics, and Reports should all import from
// here so the numbers can never drift apart between pages.

import { Direction, Trade } from "./trades";

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

export type TradeSummary = {
  count: number;
  totalPnl: number;
  /** Win rate as a 0-100 percentage across decided (non-breakeven) trades. Null if there are none. */
  winRate: number | null;
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
 */
export function summarizeTrades(trades: Trade[]): TradeSummary {
  const count = trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const breakeven = count - wins - losses;
  const decided = wins + losses;
  const winRate = decided > 0 ? (wins / decided) * 100 : null;

  const rValues = trades
    .map((t) => t.r_multiple)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  const avgR = rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null;

  return { count, totalPnl, winRate, avgR, wins, losses, breakeven };
}

export type EquityPoint = {
  /** The trade's entry_date, or "start" for the seed point before any trades. */
  date: string;
  balance: number;
};

/**
 * Builds a running equity curve from a starting balance plus each trade's
 * P&L, applied in chronological order. One point per trade (plus a seed
 * point for the starting balance) rather than per calendar day — this keeps
 * it exactly consistent with summarizeTrades' totals with no separate
 * date-bucketing logic to drift out of sync.
 */
export function buildEquityCurve(trades: Trade[], startingBalance: number): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
  );

  let balance = startingBalance;
  const points: EquityPoint[] = [{ date: "start", balance }];
  for (const t of sorted) {
    balance += t.pnl;
    points.push({ date: t.entry_date, balance });
  }
  return points;
}
