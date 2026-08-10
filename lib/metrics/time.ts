// Calendar and clock-time oriented views: period buckets (day/week/month),
// time-of-day buckets, holding-time buckets, monthly calendar aggregation,
// and the best/worst trade & row-emphasis helpers that ride along with them.

import { Trade } from "../trades";
import { localDateString } from "../date";
import { summarizeTrades } from "./pnl";

/**
 * "YYYY-MM" prefix for a given year and 0-indexed month — matches directly
 * against entry_date's own "YYYY-MM-DD" prefix instead of constructing a
 * Date object per trade. getTradesInMonth below takes a 1-indexed month
 * (matching its public Trade-filtering siblings) and builds the same kind
 * of prefix inline, since it's a one-line difference not worth a shared
 * helper with a confusing 0- vs 1-indexed split.
 */
function monthPrefix(year: number, month0Indexed: number): string {
  return `${year}-${String(month0Indexed + 1).padStart(2, "0")}`;
}

/** Trades whose entry_date falls in the current calendar month (local time). */
export function getTradesInCurrentMonth(trades: Trade[]): Trade[] {
  const now = new Date();
  const prefix = monthPrefix(now.getFullYear(), now.getMonth());
  return trades.filter((t) => t.entry_date.startsWith(prefix));
}

export type PeriodGranularity = "day" | "week" | "month";

export type PeriodBucket = {
  /** ISO date for day/week (week = that week's Monday), or "YYYY-MM" for month. */
  key: string;
  label: string;
  pnl: number;
  count: number;
};

/**
 * Just the bucket key for a trade's entry_date — no Date object needed for
 * "day" (the raw ISO string already IS the key). Cheap enough to call once
 * per trade; the label (which needs an actual Date + locale formatting) is
 * computed separately, only once per unique bucket — see getPnlByPeriod.
 */
function periodKeyOnly(dateStr: string, granularity: PeriodGranularity): string {
  if (granularity === "day") return dateStr;
  const d = new Date(dateStr + "T00:00:00");
  if (granularity === "month") {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const monday = new Date(d);
  const dow = (d.getDay() + 6) % 7; // 0 = Monday
  monday.setDate(d.getDate() - dow);
  return localDateString(monday);
}

/** Display label for a bucket, given its key — see periodKeyOnly. */
function periodLabel(key: string, granularity: PeriodGranularity): string {
  if (granularity === "month") {
    const [year, month] = key.split("-").map(Number);
    const d = new Date(year, month - 1, 1);
    return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
  }
  // "week" and "day" keys are both plain ISO dates (the bucket's Monday, or
  // the trade's own entry_date respectively) — same label format for both.
  const d = new Date(key + "T00:00:00");
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Buckets trades' P&L by day, week (Monday-start), or month, sorted
 * chronologically. Used for the P&L-by-period bar chart on Analytics.
 *
 * The label (Date construction + locale formatting) is computed only once
 * per unique bucket, not once per trade — with month/week granularity over
 * a large trade history, the number of unique buckets is typically a tiny
 * fraction of the trade count, so this avoids a lot of redundant Date/
 * toLocaleDateString work on every recompute.
 */
export function getPnlByPeriod(trades: Trade[], granularity: PeriodGranularity): PeriodBucket[] {
  const buckets = new Map<string, PeriodBucket>();
  for (const t of trades) {
    const key = periodKeyOnly(t.entry_date, granularity);
    const existing = buckets.get(key);
    if (existing) {
      existing.pnl += t.pnl;
      existing.count += 1;
    } else {
      buckets.set(key, { key, label: periodLabel(key, granularity), pnl: t.pnl, count: 1 });
    }
  }
  return Array.from(buckets.values()).sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}

/**
 * Which clock-time field the "performance by time of day" chart buckets
 * trades by. "entry" is when a trade was taken; "exit" is when it was
 * closed — for a strategy that holds trades for hours, these can tell very
 * different stories (e.g. entries clustered at the open but exits spread
 * through the day), which is why the chart lets the user toggle between them
 * rather than picking one.
 */
export type TimeOfDaySource = "entry" | "exit";

export const TIME_OF_DAY_SOURCES: { value: TimeOfDaySource; label: string }[] = [
  { value: "entry", label: "Entry time" },
  { value: "exit", label: "Exit time" },
];

function timeSourceValue(trade: Trade, source: TimeOfDaySource): string | null {
  return source === "entry" ? trade.entry_time : trade.exit_time;
}

/** Pulls the 0-23 hour out of an "HH:MM" / "HH:MM:SS" time string. Returns null if unparseable. */
function hourOf(time: string): number | null {
  const hour = parseInt(time.slice(0, 2), 10);
  return Number.isNaN(hour) || hour < 0 || hour > 23 ? null : hour;
}

export type TimeOfDayBucket = {
  key: string;
  hour: number;
  label: string;
  count: number;
  totalPnl: number;
  winRateStrict: number | null;
  winRateDecided: number | null;
  avgR: number | null;
};

/**
 * Groups trades into 24 hourly buckets (local time, midnight to 11pm) by
 * either their entry time or their exit time, for the Analytics "performance
 * by time of day" chart. Trades with no recorded value for the chosen field
 * are left out of every bucket — see countMissingTimeOfDay for surfacing how
 * many that is.
 */
export function getPerformanceByHour(trades: Trade[], source: TimeOfDaySource): TimeOfDayBucket[] {
  const byHour: Trade[][] = Array.from({ length: 24 }, () => []);

  for (const t of trades) {
    const time = timeSourceValue(t, source);
    if (!time) continue;
    const hour = hourOf(time);
    if (hour == null) continue;
    byHour[hour].push(t);
  }

  return byHour.map((hourTrades, hour) => {
    const summary = summarizeTrades(hourTrades);
    return {
      key: `h${hour}`,
      hour,
      label: `${String(hour).padStart(2, "0")}:00`,
      count: summary.count,
      totalPnl: summary.totalPnl,
      winRateStrict: summary.winRateStrict,
      winRateDecided: summary.winRateDecided,
      avgR: summary.avgR,
    };
  });
}

/** Trades falling into a specific hour bucket (by its "h0".."h23" key) for the chosen time source — used for drill-down. */
export function getTradesInHourBucket(trades: Trade[], source: TimeOfDaySource, bucketKey: string): Trade[] {
  const hour = parseInt(bucketKey.slice(1), 10);
  if (Number.isNaN(hour)) return [];
  return trades.filter((t) => {
    const time = timeSourceValue(t, source);
    return time != null && hourOf(time) === hour;
  });
}

/** How many trades in the set have no recorded value for the chosen time source — for an "excluded" note under the chart. */
export function countMissingTimeOfDay(trades: Trade[], source: TimeOfDaySource): number {
  return trades.filter((t) => !timeSourceValue(t, source)).length;
}

/**
 * How long a trade was held, in minutes — from entry_date+entry_time to
 * exit_date+exit_time. Both a full entry timestamp AND a full exit
 * timestamp are required; a trade missing any of the four fields (common
 * for older manually-entered trades, since all four are optional) has no
 * reliable duration and returns null rather than guessing. Also guards
 * against a negative duration from a data-entry mistake (exit logged
 * before entry).
 */
function holdingMinutes(trade: Trade): number | null {
  if (!trade.entry_time || !trade.exit_date || !trade.exit_time) return null;
  const start = new Date(`${trade.entry_date}T${trade.entry_time}`);
  const end = new Date(`${trade.exit_date}T${trade.exit_time}`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const minutes = (end.getTime() - start.getTime()) / 60000;
  return minutes >= 0 ? minutes : null;
}

// Bucket edges span from sub-minute scalps through multi-day swings, since
// a single trader can reasonably work all three styles. Bucket i covers
// [edges[i], edges[i+1]) minutes.
const HOLDING_BUCKET_EDGES_MINUTES = [0, 1, 5, 15, 30, 60, 120, 240, 480, 1440, 4320, Infinity];
const HOLDING_BUCKET_LABELS = [
  "<1m",
  "1-5m",
  "5-15m",
  "15-30m",
  "30-60m",
  "1-2h",
  "2-4h",
  "4-8h",
  "8-24h",
  "1-3d",
  "3d+",
];

export type HoldingTimeBucket = {
  key: string;
  label: string;
  count: number;
  totalPnl: number;
  winRateStrict: number | null;
  winRateDecided: number | null;
  avgR: number | null;
};

/**
 * Groups trades into holding-time buckets (entry timestamp to exit
 * timestamp) for the Analytics "performance by holding time" chart. Trades
 * without a full entry AND exit timestamp are left out of every bucket —
 * see countMissingHoldingTime for surfacing how many that is.
 */
export function getPerformanceByHoldingTime(trades: Trade[]): HoldingTimeBucket[] {
  const byBucket: Trade[][] = HOLDING_BUCKET_LABELS.map(() => []);

  for (const t of trades) {
    const minutes = holdingMinutes(t);
    if (minutes == null) continue;
    for (let i = 0; i < HOLDING_BUCKET_EDGES_MINUTES.length - 1; i++) {
      if (minutes >= HOLDING_BUCKET_EDGES_MINUTES[i] && minutes < HOLDING_BUCKET_EDGES_MINUTES[i + 1]) {
        byBucket[i].push(t);
        break;
      }
    }
  }

  return HOLDING_BUCKET_LABELS.map((label, i) => {
    const summary = summarizeTrades(byBucket[i]);
    return {
      key: `ht${i}`,
      label,
      count: summary.count,
      totalPnl: summary.totalPnl,
      winRateStrict: summary.winRateStrict,
      winRateDecided: summary.winRateDecided,
      avgR: summary.avgR,
    };
  });
}

/** Trades falling into a specific holding-time bucket (by its "ht0".."ht10" key) — used for drill-down. */
export function getTradesInHoldingTimeBucket(trades: Trade[], bucketKey: string): Trade[] {
  const idx = HOLDING_BUCKET_LABELS.findIndex((_, i) => `ht${i}` === bucketKey);
  if (idx === -1) return [];
  const min = HOLDING_BUCKET_EDGES_MINUTES[idx];
  const max = HOLDING_BUCKET_EDGES_MINUTES[idx + 1];
  return trades.filter((t) => {
    const minutes = holdingMinutes(t);
    return minutes != null && minutes >= min && minutes < max;
  });
}

/** How many trades in the set have no reliable holding-time (missing entry or exit timestamp) — for an "excluded" note under the chart. */
export function countMissingHoldingTime(trades: Trade[]): number {
  return trades.filter((t) => holdingMinutes(t) == null).length;
}

/** Trades whose entry_date falls within the given calendar month. `month` is 1-indexed (Jan = 1). */
export function getTradesInMonth(trades: Trade[], year: number, month: number): Trade[] {
  // entry_date is already a zero-padded "YYYY-MM-DD" string, so a prefix
  // match answers "is this trade in this month" without constructing a
  // Date object (and running getFullYear/getMonth) for every trade in the
  // account's full history — see getDailyPnlForMonth below, which builds
  // on this function's result instead of re-scanning `trades` itself.
  const prefix = `${year}-${String(month).padStart(2, "0")}`;
  return trades.filter((t) => t.entry_date.startsWith(prefix));
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
 *
 * Takes the month's trades directly (already filtered by getTradesInMonth)
 * rather than the full account history — the Reports page previously called
 * this with the same full `trades` array it also passed to getTradesInMonth,
 * so every month switch did two independent full-history passes (each
 * constructing a Date per trade) to answer overlapping questions. Callers
 * should compute monthTrades once via getTradesInMonth and pass that here;
 * this function no longer needs to re-check year/month itself.
 */
export function getDailyPnlForMonth(monthTrades: Trade[], year: number, month: number): MonthlyDayPnl[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const byDate = new Map<string, { pnl: number; count: number }>();

  for (const t of monthTrades) {
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

export type TradeRowEmphasis = {
  maxAbsPnl: number;
  bestId: string | null;
  worstId: string | null;
};

/**
 * Single source of truth for the "content-aware" row treatment used on the
 * Trades list and Reports' monthly table: how far each row's P&L magnitude
 * bar should fill (scaled to the largest mover in the set the caller
 * passes in), and which single trade — if any — gets the Best/Worst
 * highlight. Reuses getBestWorstTrade above so the two views can never
 * disagree on which trade is "best". Only highlights when best and worst
 * are different trades, so a single-trade set (or an all-tied set)
 * highlights nothing.
 *
 * Always call this through useMemo keyed on the trades array it's given —
 * it does a few full passes over the list, which is fine once per actual
 * data change but adds up if it reruns on every unrelated re-render
 * (typing in an unrelated filter, selecting a row, opening a modal).
 */
export function getTradeRowEmphasis(trades: Trade[]): TradeRowEmphasis {
  const maxAbsPnl = trades.reduce((max, t) => Math.max(max, Math.abs(t.pnl)), 0);
  if (trades.length <= 1) return { maxAbsPnl, bestId: null, worstId: null };
  const { best, worst } = getBestWorstTrade(trades);
  if (!best || !worst || best.id === worst.id) return { maxAbsPnl, bestId: null, worstId: null };
  return { maxAbsPnl, bestId: best.id, worstId: worst.id };
}
