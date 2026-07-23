// Shared calculation logic for trade metrics.
// Dashboard, Trades, Analytics, and Reports should all import from
// here so the numbers can never drift apart between pages.

import { Direction, Trade } from "./trades";
import { localDateString } from "./date";

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
 */
export function summarizeTrades(trades: Trade[]): TradeSummary {
  const count = trades.length;
  const totalPnl = trades.reduce((sum, t) => sum + t.pnl, 0);
  const wins = trades.filter((t) => t.pnl > 0).length;
  const losses = trades.filter((t) => t.pnl < 0).length;
  const breakeven = count - wins - losses;
  const decided = wins + losses;
  const winRateStrict = count > 0 ? (wins / count) * 100 : null;
  const winRateDecided = decided > 0 ? (wins / decided) * 100 : null;

  const rValues = trades
    .map((t) => t.r_multiple)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  const avgR = rValues.length > 0 ? rValues.reduce((s, r) => s + r, 0) / rValues.length : null;

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
 * The single chronological ordering used by every equity/balance-over-time
 * calculation below (buildEquityCurve, getCurrentStreak,
 * getBalanceBeforeTrade) — sorted here once so those can never disagree
 * with each other about trade order.
 */
function sortTradesChronologically(trades: Trade[]): Trade[] {
  return [...trades].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
  );
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
  /** Percentage form of maxAmount — same zero-or-negative-peak caveat as currentPct. */
  maxPct: number | null;
};

/**
 * Peak-to-trough drawdown computed from the same equity curve points used
 * by the chart, so this always agrees with what's plotted.
 */
export function getDrawdown(points: EquityPoint[]): Drawdown {
  let peak = points[0]?.balance ?? 0;
  let maxAmount = 0;
  let maxPct: number | null = null;

  for (const p of points) {
    if (p.balance > peak) peak = p.balance;
    const amount = peak - p.balance;
    if (amount > maxAmount) {
      maxAmount = amount;
      maxPct = peak > 0 ? (amount / peak) * 100 : null;
    }
  }

  const last = points[points.length - 1]?.balance ?? 0;
  let lastPeak = points[0]?.balance ?? 0;
  for (const p of points) {
    if (p.balance > lastPeak) lastPeak = p.balance;
  }
  const currentAmount = lastPeak - last;
  const currentPct = lastPeak > 0 ? (currentAmount / lastPeak) * 100 : null;

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
 * |entry - stop| * size / balance-at-that-trade * 100, averaged across
 * trades that have all three inputs recorded. Used to compare against a
 * target risk-per-trade ceiling set in Settings.
 *
 * Each trade is measured against the balance it actually had BEFORE that
 * trade (via balanceBeforeByTradeId, from getBalanceBeforeTrade) rather
 * than today's balance — a trade placed early in the month shouldn't have
 * its risk % distorted by wins or losses that happened after it.
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
    const key = localDateString(monday);
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
 * Dimensions trades can be grouped by. "instrument" through "direction" power
 * the Analytics "Performance breakdown" section (Part 2); "emotion" and
 * "rules_followed" power the behavioral-analytics section (Part 3).
 * "direction" and "rules_followed" read from their own fields (the latter
 * is a boolean mapped to "yes"/"no"); every other value reads the matching
 * Trade field of the same name.
 */
export type BreakdownDimension =
  | "instrument"
  | "asset_class"
  | "strategy"
  | "session"
  | "direction"
  | "emotion"
  | "rules_followed";

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
  winRateStrict: number | null;
  winRateDecided: number | null;
  avgR: number | null;
};

function breakdownFieldValue(trade: Trade, dimension: BreakdownDimension): string | null {
  if (dimension === "direction") return trade.direction;
  if (dimension === "rules_followed") return trade.rules_followed === null ? null : trade.rules_followed ? "yes" : "no";
  return trade[dimension];
}

function breakdownLabel(value: string | null, dimension: BreakdownDimension): string {
  if (value == null) return "Unspecified";
  if (dimension === "direction") return value === "long" ? "Long" : "Short";
  if (dimension === "rules_followed") return value === "yes" ? "Rules followed" : "Rules not followed";
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
      winRateStrict: summary.winRateStrict,
      winRateDecided: summary.winRateDecided,
      avgR: summary.avgR,
    });
  }

  return result.sort((a, b) => b.totalPnl - a.totalPnl);
}

/** Trades matching a specific breakdown group's key for the given dimension — used for drill-down. */
export function getTradesInBreakdownGroup(trades: Trade[], dimension: BreakdownDimension, key: string): Trade[] {
  return trades.filter((t) => (breakdownFieldValue(t, dimension) ?? "unspecified") === key);
}

/** Fixed R-multiple bucket edges: bucket i covers [edges[i], edges[i+1]). */
const R_BUCKET_EDGES = [-Infinity, -2, -1, 0, 1, 2, 3, Infinity];
const R_BUCKET_LABELS = ["< -2R", "-2R to -1R", "-1R to 0R", "0R to 1R", "1R to 2R", "2R to 3R", "> 3R"];

export type RMultipleBucket = {
  key: string;
  label: string;
  count: number;
  totalPnl: number;
  /** True if this bucket represents a losing R range (used for bar color). */
  isLoss: boolean;
};

/**
 * Distributes trades with a recorded r_multiple into fixed R-sized buckets,
 * for the "R-multiple distribution" histogram on Analytics. Trades without
 * a recorded r_multiple are excluded (same convention as summarizeTrades'
 * avgR, which also only considers trades that have one).
 */
export function getRMultipleDistribution(trades: Trade[]): RMultipleBucket[] {
  const buckets: RMultipleBucket[] = R_BUCKET_LABELS.map((label, i) => ({
    key: `r${i}`,
    label,
    count: 0,
    totalPnl: 0,
    isLoss: R_BUCKET_EDGES[i + 1] <= 0,
  }));

  for (const t of trades) {
    if (t.r_multiple == null || Number.isNaN(t.r_multiple)) continue;
    for (let i = 0; i < R_BUCKET_EDGES.length - 1; i++) {
      if (t.r_multiple >= R_BUCKET_EDGES[i] && t.r_multiple < R_BUCKET_EDGES[i + 1]) {
        buckets[i].count += 1;
        buckets[i].totalPnl += t.pnl;
        break;
      }
    }
  }

  return buckets;
}

/** Trades falling into a specific R-multiple bucket (by its "r0".."r6" key) — used for drill-down. */
export function getTradesInRMultipleBucket(trades: Trade[], bucketKey: string): Trade[] {
  const idx = R_BUCKET_LABELS.findIndex((_, i) => `r${i}` === bucketKey);
  if (idx === -1) return [];
  const min = R_BUCKET_EDGES[idx];
  const max = R_BUCKET_EDGES[idx + 1];
  return trades.filter((t) => t.r_multiple != null && !Number.isNaN(t.r_multiple) && t.r_multiple >= min && t.r_multiple < max);
}

/** Trades whose entry_date falls within the given calendar month. `month` is 1-indexed (Jan = 1). */
export function getTradesInMonth(trades: Trade[], year: number, month: number): Trade[] {
  return trades.filter((t) => {
    const d = new Date(t.entry_date + "T00:00:00");
    return d.getFullYear() === year && d.getMonth() + 1 === month;
  });
}

export type MonthlyDayPnl = {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  day: number;
  pnl: number;
  count: number;
};

/**
 * One entry per calendar day in the given month (1-indexed), with summed
 * P&L and trade count — zeros for days with no trades. Used for the
 * Reports calendar heatmap.
 */
export function getDailyPnlForMonth(trades: Trade[], year: number, month: number): MonthlyDayPnl[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = new Map<string, { pnl: number; count: number }>();

  for (const t of trades) {
    const d = new Date(t.entry_date + "T00:00:00");
    if (d.getFullYear() !== year || d.getMonth() + 1 !== month) continue;
    const existing = byDate.get(t.entry_date);
    if (existing) {
      existing.pnl += t.pnl;
      existing.count += 1;
    } else {
      byDate.set(t.entry_date, { pnl: t.pnl, count: 1 });
    }
  }

  const result: MonthlyDayPnl[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const entry = byDate.get(dateStr);
    result.push({ date: dateStr, day, pnl: entry?.pnl ?? 0, count: entry?.count ?? 0 });
  }
  return result;
}

export type BestWorstDay = {
  best: MonthlyDayPnl | null;
  worst: MonthlyDayPnl | null;
};

/** The best and worst trading days (by P&L) among days that actually had trades. */
export function getBestWorstDay(dailyPnls: MonthlyDayPnl[]): BestWorstDay {
  const traded = dailyPnls.filter((d) => d.count > 0);
  if (traded.length === 0) return { best: null, worst: null };
  let best = traded[0];
  let worst = traded[0];
  for (const d of traded) {
    if (d.pnl > best.pnl) best = d;
    if (d.pnl < worst.pnl) worst = d;
  }
  return { best, worst };
}

export type BestWorstTrade = {
  best: Trade | null;
  worst: Trade | null;
};

/**
 * The single biggest-winning and biggest-losing trade (by raw P&L) in a set
 * of trades — used for the Reports "spotlight" cards. Distinct from
 * getBestWorstDay, which aggregates by calendar day rather than by trade.
 */
export function getBestWorstTrade(trades: Trade[]): BestWorstTrade {
  if (trades.length === 0) return { best: null, worst: null };
  let best = trades[0];
  let worst = trades[0];
  for (const t of trades) {
    if (t.pnl > best.pnl) best = t;
    if (t.pnl < worst.pnl) worst = t;
  }
  return { best, worst };
}

export type TagCount = {
  tag: string;
  count: number;
};

/**
 * Counts how often each tag appears across a set of trades, sorted by
 * frequency descending (ties broken alphabetically for a stable order).
 * Used for the Reports "tag frequency" view.
 */
export function getTagFrequency(trades: Trade[]): TagCount[] {
  const counts = new Map<string, number>();
  for (const t of trades) {
    for (const tag of t.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
