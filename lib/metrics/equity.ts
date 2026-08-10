// Equity curve, streak, drawdown, and date-range scoping — everything that
// depends on trades' CHRONOLOGICAL order rather than just aggregating a set.

import { Trade } from "../trades";
import { localDateString } from "../date";

/**
 * The single chronological ordering used by every equity/balance-over-time
 * calculation below (buildEquityCurve, getCurrentStreak,
 * getBalanceBeforeTrade) — sorted here once so those can never disagree
 * with each other about trade order.
 *
 * Plain `<`/`>` rather than localeCompare: entry_date/created_at are
 * zero-padded ISO strings, which already sort correctly with primitive
 * comparison — localeCompare's locale-aware collation is pure overhead here,
 * and this comparator runs on every equity-curve rebuild.
 */
function sortTradesChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort((a, b) => {
    if (a.entry_date !== b.entry_date) return a.entry_date < b.entry_date ? -1 : 1;
    if (a.created_at !== b.created_at) return a.created_at < b.created_at ? -1 : 1;
    return 0;
  });
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
  const sorted = sortTradesChronologically(trades);

  let balance = startingBalance;
  const points: EquityPoint[] = [{ date: "start", balance }];
  for (const t of sorted) {
    balance += t.pnl;
    points.push({ date: t.entry_date, balance });
  }
  return points;
}

/**
 * Maps each trade's id to the account balance immediately BEFORE that
 * trade's P&L was applied — i.e. the balance it was actually risked
 * against, as opposed to today's balance. Built from the exact same
 * chronological order and running total as buildEquityCurve (in fact each
 * trade's "before" balance is just the prior point on that same curve), so
 * the two can never disagree.
 *
 * Pass the account's FULL trade history here, not a filtered subset — a
 * trade's balance-before depends on everything that happened earlier in
 * the account, not just on whichever subset you're currently averaging
 * over (e.g. this month). Look results up by trade id afterward.
 */
export function getBalanceBeforeTrade(trades: Trade[], startingBalance: number): Map<string, number> {
  const sorted = sortTradesChronologically(trades);
  const map = new Map<string, number>();
  let balance = startingBalance;
  for (const t of sorted) {
    map.set(t.id, balance);
    balance += t.pnl;
  }
  return map;
}

export type Streak = {
  type: "win" | "loss" | null;
  count: number;
};

/**
 * Current win/loss streak, walking backward from the most recent trade.
 * Breakeven trades (pnl === 0) end the streak rather than counting toward
 * either side. Trades are sorted the same way as buildEquityCurve so this
 * always agrees with the equity curve's chronological order.
 */
export function getCurrentStreak(trades: Trade[]): Streak {
  const sorted = sortTradesChronologically(trades);

  let type: "win" | "loss" | null = null;
  let count = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const pnl = sorted[i].pnl;
    const outcome: "win" | "loss" | null = pnl > 0 ? "win" : pnl < 0 ? "loss" : null;
    if (outcome === null) break;
    if (type === null) type = outcome;
    if (outcome !== type) break;
    count++;
  }
  return { type: count > 0 ? type : null, count };
}

export type Drawdown = {
  /** Amount below the equity curve's running peak, at the most recent point. */
  currentAmount: number;
  /**
   * Percentage form of currentAmount, relative to the peak balance it drew
   * down from. Null when that peak was zero or negative — a starting
   * balance of $0, or an account that was already underwater at its best
   * point, has no meaningful "percent below peak" (dividing by a
   * zero-or-negative peak either throws or silently produces a number that
   * understates how bad things are). The dollar amount is always well
   * defined regardless; only the percentage is undefined here.
   */
  currentPct: number | null;
  /** The largest peak-to-trough drop seen anywhere in the curve. */
  maxAmount: number;
  /**
   * Percentage form of maxAmount. 0 when the curve has a valid (positive)
   * peak but no drawdown ever occurred (monotonically rising, or a
   * single-point curve) — there IS a well-defined answer in that case, and
   * it's zero. Null only in the genuine zero-or-negative-peak case, where
   * "percent below peak" has no meaningful denominator at all.
   */
  maxPct: number | null;
};

/**
 * Peak-to-trough drawdown computed from the same equity curve points used
 * by the chart, so this always agrees with what's plotted.
 */
export function getDrawdown(points: EquityPoint[]): Drawdown {
  let peak = points[0]?.balance ?? 0;
  let maxAmount = 0;

  for (const p of points) {
    if (p.balance > peak) peak = p.balance;
    const amount = peak - p.balance;
    if (amount > maxAmount) {
      maxAmount = amount;
    }
  }
  // maxAmount is always well-defined (0 when no drawdown ever occurred).
  // maxPct follows the peak reached at the point of that max drawdown —
  // for the common "never drawn down" case that's just the curve's overall
  // peak, since maxAmount is 0 everywhere. Null only when that peak itself
  // isn't a valid percentage basis (zero or negative).
  const maxPct = peak > 0 ? (maxAmount / peak) * 100 : null;

  const last = points[points.length - 1]?.balance ?? 0;
  let lastPeak = points[0]?.balance ?? 0;
  for (const p of points) {
    if (p.balance > lastPeak) lastPeak = p.balance;
  }
  const currentAmount = lastPeak - last;
  const currentPct = lastPeak > 0 ? (currentAmount / lastPeak) * 100 : null;

  return { currentAmount, currentPct, maxAmount, maxPct };
}

export type DateRange = "7d" | "30d" | "90d" | "ytd" | "all";

/** The earliest entry_date (inclusive) to include for a given range, or null for "all". */
export function getRangeCutoffDate(range: DateRange): string | null {
  if (range === "all") return null;

  const now = new Date();
  let cutoff: Date;
  if (range === "ytd") {
    cutoff = new Date(now.getFullYear(), 0, 1);
  } else {
    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
  }
  return localDateString(cutoff);
}

/** Filters trades to those with entry_date within the given range, ending today. */
export function filterTradesByRange(trades: Trade[], range: DateRange): Trade[] {
  const cutoffStr = getRangeCutoffDate(range);
  if (cutoffStr == null) return trades;
  return trades.filter((t) => t.entry_date >= cutoffStr);
}

/**
 * Builds an equity curve scoped to a date range: trades before the range
 * cutoff are folded into a single seed balance (so the curve still reflects
 * the account's true balance at the start of the range), then one point is
 * added per trade inside the range, exactly like buildEquityCurve.
 *
 * Single O(n) partition pass over the full trade list — no sort here. The
 * "before" side only needs a sum (order doesn't matter for that), and the
 * "within" side gets sorted exactly once, inside buildEquityCurve, instead
 * of once here and then again there. This matters most for a short range
 * (e.g. "7d") against a long trade history, where the old version sorted
 * the entire history just to throw most of it away.
 */
export function buildEquityCurveForRange(
  trades: Trade[],
  startingBalance: number,
  range: DateRange
): EquityPoint[] {
  const cutoffStr = getRangeCutoffDate(range);

  let seedBalance = startingBalance;
  const within: Trade[] = [];
  for (const t of trades) {
    if (cutoffStr != null && t.entry_date < cutoffStr) {
      seedBalance += t.pnl;
    } else {
      within.push(t);
    }
  }

  return buildEquityCurve(within, seedBalance);
}
