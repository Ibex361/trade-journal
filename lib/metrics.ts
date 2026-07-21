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
  const sorted = [...trades].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
  );

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
  currentPct: number;
  /** The largest peak-to-trough drop seen anywhere in the curve. */
  maxAmount: number;
  maxPct: number;
};

/**
 * Peak-to-trough drawdown computed from the same equity curve points used
 * by the chart, so this always agrees with what's plotted.
 */
export function getDrawdown(points: EquityPoint[]): Drawdown {
  let peak = points[0]?.balance ?? 0;
  let maxAmount = 0;
  let maxPct = 0;

  for (const p of points) {
    if (p.balance > peak) peak = p.balance;
    const amount = peak - p.balance;
    const pct = peak > 0 ? (amount / peak) * 100 : 0;
    if (amount > maxAmount) {
      maxAmount = amount;
      maxPct = pct;
    }
  }

  const last = points[points.length - 1]?.balance ?? 0;
  let lastPeak = points[0]?.balance ?? 0;
  for (const p of points) {
    if (p.balance > lastPeak) lastPeak = p.balance;
  }
  const currentAmount = lastPeak - last;
  const currentPct = lastPeak > 0 ? (currentAmount / lastPeak) * 100 : 0;

  return { currentAmount, currentPct, maxAmount, maxPct };
}

/** Trades whose entry_date falls in the current calendar month (local time). */
export function getTradesInCurrentMonth(trades: Trade[]): Trade[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  return trades.filter((t) => {
    const d = new Date(t.entry_date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() === month;
  });
}

/**
 * Average risk per trade as a percentage of account balance, i.e.
 * |entry - stop| * size / accountBalance * 100, averaged across trades
 * that have all three inputs recorded. Used to compare against a target
 * risk-per-trade ceiling set in Settings.
 */
export function getAvgRiskPct(trades: Trade[], accountBalance: number): number | null {
  if (accountBalance <= 0) return null;
  const pcts = trades
    .filter((t) => t.entry_price != null && t.stop_loss_price != null && t.size != null)
    .map((t) => (Math.abs(t.entry_price! - t.stop_loss_price!) * t.size!) / accountBalance * 100);
  if (pcts.length === 0) return null;
  return pcts.reduce((s, v) => s + v, 0) / pcts.length;
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
  return cutoff.toISOString().slice(0, 10);
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
 */
export function buildEquityCurveForRange(
  trades: Trade[],
  startingBalance: number,
  range: DateRange
): EquityPoint[] {
  const sorted = [...trades].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
  );
  const cutoffStr = getRangeCutoffDate(range);

  const before = cutoffStr == null ? [] : sorted.filter((t) => t.entry_date < cutoffStr);
  const within = cutoffStr == null ? sorted : sorted.filter((t) => t.entry_date >= cutoffStr);

  const seedBalance = startingBalance + before.reduce((s, t) => s + t.pnl, 0);
  return buildEquityCurve(within, seedBalance);
}

/**
 * Profit factor = gross profit / gross loss. Null if there are no losing
 * trades to divide by (undefined ratio) or no trades at all.
 */
export function getProfitFactor(trades: Trade[]): number | null {
  const grossProfit = trades.filter((t) => t.pnl > 0).reduce((s, t) => s + t.pnl, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.pnl < 0).reduce((s, t) => s + t.pnl, 0));
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
  const perTrade = trades.reduce((s, t) => s + t.pnl, 0) / trades.length;
  const rValues = trades.map((t) => t.r_multiple).filter((r): r is number => r != null && !Number.isNaN(r));
  const perR = rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null;
  return { perTrade, perR };
}

/** Total P&L across the trades as a percentage of the account's starting balance. */
export function getTotalReturnPct(trades: Trade[], startingBalance: number): number | null {
  if (startingBalance <= 0) return null;
  const totalPnl = trades.reduce((s, t) => s + t.pnl, 0);
  return (totalPnl / startingBalance) * 100;
}

export type PeriodGranularity = "day" | "week" | "month";

export type PeriodBucket = {
  /** ISO date for day/week (week = that week's Monday), or "YYYY-MM" for month. */
  key: string;
  label: string;
  pnl: number;
  count: number;
};

function periodKey(dateStr: string, granularity: PeriodGranularity): { key: string; label: string } {
  const d = new Date(dateStr + "T00:00:00");
  if (granularity === "month") {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
    return { key, label };
  }
  if (granularity === "week") {
    const monday = new Date(d);
    const dow = (d.getDay() + 6) % 7; // 0 = Monday
    monday.setDate(d.getDate() - dow);
    const key = monday.toISOString().slice(0, 10);
    const label = monday.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return { key, label };
  }
  const label = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  return { key: dateStr, label };
}

/**
 * Buckets trades' P&L by day, week (Monday-start), or month, sorted
 * chronologically. Used for the P&L-by-period bar chart on Analytics.
 */
export function getPnlByPeriod(trades: Trade[], granularity: PeriodGranularity): PeriodBucket[] {
  const buckets = new Map<string, PeriodBucket>();
  for (const t of trades) {
    const { key, label } = periodKey(t.entry_date, granularity);
    const existing = buckets.get(key);
    if (existing) {
      existing.pnl += t.pnl;
      existing.count += 1;
    } else {
      buckets.set(key, { key, label, pnl: t.pnl, count: 1 });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * Dimensions trades can be grouped by on the Analytics "Breakdowns" section.
 * "direction" reads from the direction field; every other value reads the
 * matching Trade field of the same name.
 */
export type BreakdownDimension = "instrument" | "asset_class" | "strategy" | "session" | "direction";

export const BREAKDOWN_DIMENSIONS: { value: BreakdownDimension; label: string }[] = [
  { value: "instrument", label: "Instrument" },
  { value: "asset_class", label: "Asset class" },
  { value: "strategy", label: "Strategy" },
  { value: "session", label: "Session" },
  { value: "direction", label: "Direction" },
];

export type BreakdownGroup = {
  /** Raw field value used to match trades back for drill-down; "unspecified" if null. */
  key: string;
  label: string;
  count: number;
  totalPnl: number;
  winRate: number | null;
  avgR: number | null;
};

function breakdownFieldValue(trade: Trade, dimension: BreakdownDimension): string | null {
  if (dimension === "direction") return trade.direction;
  return trade[dimension];
}

function breakdownLabel(value: string | null, dimension: BreakdownDimension): string {
  if (value == null) return "Unspecified";
  if (dimension === "direction") return value === "long" ? "Long" : "Short";
  return value;
}

/**
 * Groups trades by the given dimension and summarizes each group using the
 * same win-rate/avg-R logic as summarizeTrades, so these figures always
 * agree with the rest of the app. Groups are sorted by total P&L descending
 * (biggest contributor first, biggest drag last).
 */
export function getBreakdownByDimension(trades: Trade[], dimension: BreakdownDimension): BreakdownGroup[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const value = breakdownFieldValue(t, dimension);
    const key = value ?? "unspecified";
    const existing = groups.get(key);
    if (existing) existing.push(t);
    else groups.set(key, [t]);
  }

  const result: BreakdownGroup[] = [];
  for (const [key, groupTrades] of groups.entries()) {
    const summary = summarizeTrades(groupTrades);
    const value = key === "unspecified" ? null : key;
    result.push({
      key,
      label: breakdownLabel(value, dimension),
      count: summary.count,
      totalPnl: summary.totalPnl,
      winRate: summary.winRate,
      avgR: summary.avgR,
    });
  }

  return result.sort((a, b) => b.totalPnl - a.totalPnl);
}

/** Trades matching a specific breakdown group's key for the given dimension — used for drill-down. */
export function getTradesInBreakdownGroup(trades: Trade[], dimension: BreakdownDimension, key: string): Trade[] {
  return trades.filter((t) => (breakdownFieldValue(t, dimension) ?? "unspecified") === key);
}
