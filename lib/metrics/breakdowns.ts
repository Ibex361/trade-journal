// Grouping/breakdown functions: split trades by strategy, instrument,
// direction, exit reason, SL management, R-multiple, tag, etc. and
// summarize each group. All group summaries reuse summarizeTrades /
// getExpectancy / getProfitFactor / buildEquityCurve / getDrawdown so
// nothing here can drift from the equivalent numbers shown elsewhere.

import { Direction, ExitReason, StopMovement, Trade } from "../trades";
import { summarizeTrades, getExpectancy, getProfitFactor, calculatePlannedRMultiple } from "./pnl";
import { buildEquityCurve, getDrawdown } from "./equity";

/**
 * Below this many trades, a strategy's stats are flagged as too small a
 * sample to trust — a few lucky/unlucky trades can otherwise make a
 * strategy look far better or worse than it really is.
 */
export const STRATEGY_MIN_SAMPLE_SIZE = 20;

export type StrategyLeaderboardRow = {
  /** Raw strategy value used to match trades back for drill-down; "unspecified" if null. */
  key: string;
  label: string;
  count: number;
  totalPnl: number;
  winRateStrict: number | null;
  winRateDecided: number | null;
  /** Average R-multiple per trade — the headline "does this system have an edge" number. */
  expectancyR: number | null;
  /** Average P&L per trade, in account currency. */
  expectancyPnl: number | null;
  /** Gross R won ÷ gross R lost. Null if there are no losing trades to divide by. */
  profitFactor: number | null;
  /** Avg winning R ÷ avg |losing R| — separates "wins often, wins small" systems from "wins rarely, wins big" ones. */
  payoffRatio: number | null;
  /** Population std deviation of R-multiple across the strategy's trades — a rough consistency/variance measure. */
  stdDevR: number | null;
  /**
   * Max peak-to-trough drawdown of this strategy's OWN trades, in isolation
   * — i.e. "if this strategy were the only thing in the account, starting
   * from 0, how bad did its own equity curve get". Not a share of the real
   * account's drawdown, since strategies interleave and can't be cleanly
   * separated out of a single real balance history.
   */
  maxDrawdownAmount: number;
  maxDrawdownPct: number | null;
  /** True when count is below STRATEGY_MIN_SAMPLE_SIZE — surface a "not enough data yet" flag in the UI. */
  lowSample: boolean;
};

/**
 * Builds one full metrics row (the shared shape used by both the strategy
 * leaderboard and the per-strategy asset/direction breakdown) for an
 * arbitrary group of trades. Built directly off summarizeTrades /
 * getExpectancy / getProfitFactor / buildEquityCurve / getDrawdown so
 * nothing here can drift from the equivalent numbers shown elsewhere in
 * the app.
 */
function buildStrategyMetricRow(key: string, label: string, groupTrades: Trade[]): StrategyLeaderboardRow {
  const summary = summarizeTrades(groupTrades);
  const expectancy = getExpectancy(groupTrades);
  const profitFactor = getProfitFactor(groupTrades);

  const rValues = groupTrades
    .map((t) => t.r_multiple)
    .filter((r): r is number => r != null && !Number.isNaN(r));
  const winningR = rValues.filter((r) => r > 0);
  const losingR = rValues.filter((r) => r < 0);
  const avgWinR = winningR.length > 0 ? winningR.reduce((s, r) => s + r, 0) / winningR.length : null;
  const avgLossR =
    losingR.length > 0 ? Math.abs(losingR.reduce((s, r) => s + r, 0) / losingR.length) : null;
  const payoffRatio = avgWinR != null && avgLossR != null && avgLossR !== 0 ? avgWinR / avgLossR : null;

  let stdDevR: number | null = null;
  if (rValues.length > 1 && expectancy.perR != null) {
    const mean = expectancy.perR;
    const variance = rValues.reduce((s, r) => s + (r - mean) ** 2, 0) / rValues.length;
    stdDevR = Math.sqrt(variance);
  }

  const drawdown = getDrawdown(buildEquityCurve(groupTrades, 0));

  return {
    key,
    label,
    count: summary.count,
    totalPnl: summary.totalPnl,
    winRateStrict: summary.winRateStrict,
    winRateDecided: summary.winRateDecided,
    expectancyR: expectancy.perR,
    expectancyPnl: expectancy.perTrade,
    profitFactor,
    payoffRatio,
    stdDevR,
    maxDrawdownAmount: drawdown.maxAmount,
    maxDrawdownPct: drawdown.maxPct,
    lowSample: summary.count < STRATEGY_MIN_SAMPLE_SIZE,
  };
}

/**
 * One row per strategy tag, covering every figure the Strategies
 * leaderboard needs. Sorted by expectancyR descending (best edge first);
 * strategies with no R data sort last.
 */
export function getStrategyLeaderboard(trades: Trade[]): StrategyLeaderboardRow[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.strategy ?? "unspecified";
    const existing = groups.get(key);
    if (existing) existing.push(t);
    else groups.set(key, [t]);
  }

  const rows: StrategyLeaderboardRow[] = [];
  for (const [key, groupTrades] of groups.entries()) {
    rows.push(buildStrategyMetricRow(key, key === "unspecified" ? "No strategy tagged" : key, groupTrades));
  }

  return rows.sort((a, b) => {
    if (a.expectancyR == null && b.expectancyR == null) return 0;
    if (a.expectancyR == null) return 1;
    if (b.expectancyR == null) return -1;
    return b.expectancyR - a.expectancyR;
  });
}

/**
 * One row per instrument × direction combination within a single strategy
 * — "which assets and which side (long/short) is this strategy actually
 * working on". Grouped by exact instrument/symbol (not asset class) per
 * the same full metric set as the leaderboard, so a strategy's row and its
 * breakdown rows are always directly comparable. strategyKey should be a
 * `key` from getStrategyLeaderboard (including "unspecified"). Sorted by
 * total P&L descending — this is "where does this strategy's P&L come
 * from", not a ranking of separate systems.
 */
export type StrategyAssetDirectionRow = StrategyLeaderboardRow & {
  instrument: string;
  direction: Direction | null;
};

export function getStrategyAssetDirectionBreakdown(
  trades: Trade[],
  strategyKey: string
): StrategyAssetDirectionRow[] {
  const strategyTrades = trades.filter((t) => (t.strategy ?? "unspecified") === strategyKey);

  const groups = new Map<string, { instrument: string; direction: Direction | null; trades: Trade[] }>();
  for (const t of strategyTrades) {
    const key = `${t.instrument}::${t.direction ?? "unspecified"}`;
    const existing = groups.get(key);
    if (existing) existing.trades.push(t);
    else groups.set(key, { instrument: t.instrument, direction: t.direction, trades: [t] });
  }

  const rows: StrategyAssetDirectionRow[] = [];
  for (const [key, group] of groups.entries()) {
    const dirLabel = group.direction === "long" ? "Long" : group.direction === "short" ? "Short" : "No direction";
    const row = buildStrategyMetricRow(key, `${group.instrument} · ${dirLabel}`, group.trades);
    rows.push({ ...row, instrument: group.instrument, direction: group.direction });
  }

  return rows.sort((a, b) => b.totalPnl - a.totalPnl);
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
  { value: "emotion", label: "Emotion" },
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

/**
 * Display metadata for each exit_reason value, shared by the chart (fill
 * color) and any other UI that needs a consistent label/order. Order here
 * is also the stacking order in the 100%-stacked bar (stop loss first,
 * since it's the segment traders most want to see at a glance).
 */
export const EXIT_REASON_META: { value: ExitReason; label: string; color: string }[] = [
  { value: "stop_loss", label: "Stop loss", color: "#FB7185" }, // loss/coral
  { value: "take_profit", label: "Take profit", color: "#5CE6C8" }, // gain/teal
  { value: "manual", label: "Manual close", color: "#7C6FF0" }, // glow-violet
  { value: "other", label: "Other", color: "#5C6180" }, // ink-muted
];

export type StrategyExitBreakdown = {
  /** Raw strategy value used to match trades back for drill-down; "unspecified" if null. */
  key: string;
  label: string;
  /** All trades for this strategy in range, regardless of whether exit_reason is set. */
  totalCount: number;
  /** Trades for this strategy with an exit_reason recorded — the denominator for the percentages below. */
  recordedCount: number;
  /** Trades for this strategy with no exit_reason recorded — excluded from the bar, called out separately. */
  missingCount: number;
  counts: Record<ExitReason, number>;
  /** Each reason's share of recordedCount, 0–100. Sums to 100 (within rounding) when recordedCount > 0. */
  pcts: Record<ExitReason, number>;
};

/**
 * For each strategy, what share of its closed trades hit the stop loss vs.
 * the take profit vs. were closed manually vs. something else — the data
 * behind the Analytics "SL/TP hit rate by strategy" chart. Percentages are
 * computed only over trades that actually have exit_reason recorded, so a
 * strategy with lots of un-tagged older trades doesn't get diluted; those
 * trades are counted in missingCount instead. Strategies with zero recorded
 * exit reasons are dropped entirely (nothing meaningful to show), and the
 * rest are sorted by recordedCount descending so the most data-rich
 * strategies read first.
 */
export function getExitReasonByStrategy(trades: Trade[]): StrategyExitBreakdown[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.strategy ?? "unspecified";
    const existing = groups.get(key);
    if (existing) existing.push(t);
    else groups.set(key, [t]);
  }

  const result: StrategyExitBreakdown[] = [];
  for (const [key, groupTrades] of groups.entries()) {
    const counts: Record<ExitReason, number> = { stop_loss: 0, take_profit: 0, manual: 0, other: 0 };
    let missingCount = 0;
    for (const t of groupTrades) {
      if (t.exit_reason) counts[t.exit_reason] += 1;
      else missingCount += 1;
    }
    const recordedCount = groupTrades.length - missingCount;
    const pcts: Record<ExitReason, number> = { stop_loss: 0, take_profit: 0, manual: 0, other: 0 };
    if (recordedCount > 0) {
      for (const reason of Object.keys(counts) as ExitReason[]) {
        pcts[reason] = (counts[reason] / recordedCount) * 100;
      }
    }
    result.push({
      key,
      label: key === "unspecified" ? "Unspecified" : key,
      totalCount: groupTrades.length,
      recordedCount,
      missingCount,
      counts,
      pcts,
    });
  }

  return result.filter((g) => g.recordedCount > 0).sort((a, b) => b.recordedCount - a.recordedCount);
}

/** Trades matching a specific strategy + exit-reason combination — used for drill-down. */
export function getTradesInStrategyExitGroup(trades: Trade[], strategyKey: string, exitReason: ExitReason): Trade[] {
  return trades.filter((t) => (t.strategy ?? "unspecified") === strategyKey && t.exit_reason === exitReason);
}

export type SlHitRateSegment = {
  /** All trades in this strategy/movement group, regardless of exit reason. */
  count: number;
  /** The subset of those that were stopped out (exit_reason === "stop_loss"). */
  hitCount: number;
  /** hitCount / count as a percentage. Null when count is 0 — there is nothing to rate, not a 0% rate. */
  hitRate: number | null;
};

export type SlHitRateRow = {
  /** Raw strategy value used to match trades back for drill-down; "unspecified" if null. */
  key: string;
  label: string;
  held: SlHitRateSegment;
  tightened: SlHitRateSegment;
  widened: SlHitRateSegment;
};

function summarizeSlHitRate(groupTrades: Trade[]): SlHitRateSegment {
  const count = groupTrades.length;
  const hitCount = groupTrades.filter((t) => t.exit_reason === "stop_loss").length;
  return { count, hitCount, hitRate: count > 0 ? (hitCount / count) * 100 : null };
}

/**
 * For each strategy, how often the stop loss actually got hit
 * (exit_reason === "stop_loss"), split by whether that stop was held,
 * tightened, or widened mid-trade — the data behind the Analytics
 * "SL-hit rate by stop management" chart. This replaces an earlier
 * weighted-win-rate-diff metric that collapsed to (trailedWins - heldWins) /
 * totalTrades — a formula that could report "no effect" even when one side
 * was a clean 2-for-2 and the other was 2-for-1000. This metric doesn't
 * compare or blend the three groups at all: each is reported on its own, so
 * nothing is diluted by the others' sample size. Trades with no sl_movement
 * recorded land in none of the three segments. Only strategies with at
 * least one trade that has an sl_movement recorded are returned.
 */
export function getSlHitRateByStrategy(trades: Trade[]): SlHitRateRow[] {
  const groups = new Map<string, Trade[]>();
  for (const t of trades) {
    const key = t.strategy ?? "unspecified";
    const existing = groups.get(key);
    if (existing) existing.push(t);
    else groups.set(key, [t]);
  }

  const result: SlHitRateRow[] = [];
  for (const [key, groupTrades] of groups.entries()) {
    const heldTrades = groupTrades.filter((t) => t.sl_movement === "held");
    const tightenedTrades = groupTrades.filter((t) => t.sl_movement === "tightened");
    const widenedTrades = groupTrades.filter((t) => t.sl_movement === "widened");
    if (heldTrades.length + tightenedTrades.length + widenedTrades.length === 0) continue;
    result.push({
      key,
      label: key === "unspecified" ? "Unspecified" : key,
      held: summarizeSlHitRate(heldTrades),
      tightened: summarizeSlHitRate(tightenedTrades),
      widened: summarizeSlHitRate(widenedTrades),
    });
  }

  return result.sort(
    (a, b) => b.held.count + b.tightened.count + b.widened.count - (a.held.count + a.tightened.count + a.widened.count)
  );
}

/** Trades for a specific strategy's held/tightened/widened SL group — used for drill-down. */
export function getTradesInSlMovementGroup(trades: Trade[], strategyKey: string, movement: StopMovement): Trade[] {
  return trades.filter((t) => (t.strategy ?? "unspecified") === strategyKey && t.sl_movement === movement);
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

/**
 * Trades excluded from the R-multiple distribution — no r_multiple was
 * ever computed for them, almost always because no stop-loss price was
 * logged (calculateRMultiple also returns null for a zero-risk stop, but
 * that's rare). Same convention as countMissingTimeOfDay/
 * countMissingHoldingTime/countMissingPlannedR — surfaced as a note under
 * the chart so a strategy or range with a lot of untagged trades doesn't
 * silently look thinner than it is.
 */
export function countMissingRMultiple(trades: Trade[]): number {
  return trades.filter((t) => t.r_multiple == null || Number.isNaN(t.r_multiple)).length;
}

export type PlannedVsRealizedPoint = {
  /** Trade id, so a clicked point can be matched back to its full Trade for drill-down. */
  id: string;
  label: string;
  strategy: string | null;
  exitReason: ExitReason | null;
  plannedR: number;
  realizedR: number;
  /** realizedR - plannedR. Positive/zero means the trade matched or beat its plan; negative means it fell short. */
  delta: number;
};

/**
 * Pairs each trade's planned R (from entry/stop/take-profit, set before the
 * trade was managed) against its realized R (the actual outcome) — the data
 * behind the Analytics "Planned vs. realized R" chart. Only trades with a
 * full plan (entry, stop loss, AND take-profit all recorded) and a realized
 * R-multiple are included; see countMissingPlannedR for what's excluded.
 */
export function getPlannedVsRealizedR(trades: Trade[]): PlannedVsRealizedPoint[] {
  const points: PlannedVsRealizedPoint[] = [];
  for (const t of trades) {
    if (t.r_multiple == null || Number.isNaN(t.r_multiple)) continue;
    const plannedR = calculatePlannedRMultiple(t.direction, t.entry_price, t.stop_loss_price, t.take_profit_price);
    if (plannedR == null) continue;
    points.push({
      id: t.id,
      label: `${t.instrument}${t.direction ? ` · ${t.direction}` : ""}`,
      strategy: t.strategy,
      exitReason: t.exit_reason,
      plannedR,
      realizedR: t.r_multiple,
      delta: t.r_multiple - plannedR,
    });
  }
  return points;
}

/**
 * Trades excluded from the planned-vs-realized chart — missing a
 * take-profit price (so no plan was ever set), a stop loss price, or a
 * realized R-multiple. Surfaced as a note under the chart, same convention
 * as countMissingTimeOfDay/countMissingHoldingTime.
 */
export function countMissingPlannedR(trades: Trade[]): number {
  return trades.filter((t) => {
    if (t.r_multiple == null || Number.isNaN(t.r_multiple)) return true;
    return calculatePlannedRMultiple(t.direction, t.entry_price, t.stop_loss_price, t.take_profit_price) == null;
  }).length;
}

export type PlannedVsRealizedSummary = {
  avgPlannedR: number | null;
  avgRealizedR: number | null;
  /** avgRealizedR - avgPlannedR — positive means, on average, trades matched or beat their plan. */
  avgDelta: number | null;
  /** Count of trades that met or exceeded their planned R (delta >= 0). */
  metOrExceededCount: number;
  /** Count of trades that fell short of their planned R (delta < 0) — stopped out, closed early, or reversed before reaching target. */
  fellShortCount: number;
};

/** Aggregate stats over a set of planned-vs-realized points — the chip row above the scatter chart. */
export function summarizePlannedVsRealizedR(points: PlannedVsRealizedPoint[]): PlannedVsRealizedSummary {
  if (points.length === 0) {
    return { avgPlannedR: null, avgRealizedR: null, avgDelta: null, metOrExceededCount: 0, fellShortCount: 0 };
  }
  const avgPlannedR = points.reduce((s, p) => s + p.plannedR, 0) / points.length;
  const avgRealizedR = points.reduce((s, p) => s + p.realizedR, 0) / points.length;
  const metOrExceededCount = points.filter((p) => p.delta >= 0).length;
  return {
    avgPlannedR,
    avgRealizedR,
    avgDelta: avgRealizedR - avgPlannedR,
    metOrExceededCount,
    fellShortCount: points.length - metOrExceededCount,
  };
}

export type TagCount = {
  tag: string;
  count: number;
  netPnl: number;
};

/**
 * Counts how often each tag appears across a set of trades, sorted by
 * frequency descending (ties broken alphabetically for a stable order).
 * Also sums each tag's net P&L, so the Reports "tag frequency" view can
 * show which setups are actually working, not just which get logged most.
 */
export function getTagFrequency(trades: Trade[]): TagCount[] {
  const counts = new Map<string, { count: number; netPnl: number }>();
  for (const t of trades) {
    for (const tag of t.tags) {
      const existing = counts.get(tag);
      if (existing) {
        existing.count += 1;
        existing.netPnl += t.pnl;
      } else {
        counts.set(tag, { count: 1, netPnl: t.pnl });
      }
    }
  }
  return Array.from(counts.entries())
    .map(([tag, { count, netPnl }]) => ({ tag, count, netPnl }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
}
