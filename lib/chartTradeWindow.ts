import { Trade } from "./trades";

// entry_date/entry_time (and exit_date/exit_time) are stored as East
// Africa Time (UTC+3) calendar values — see exnessImport.ts's
// EXNESS_TO_LOCAL_OFFSET_HOURS comment, which documents that both
// imported and manually-entered trades use this same local convention
// consistently. Twelve Data's time_series endpoint wants a timezone-aware
// range, so this offset is what lets a trade's stored local time convert
// back to the correct UTC instant for that request — it is NOT a
// generic "current browser timezone" guess, it is this app's one fixed
// data convention.
const APP_LOCAL_OFFSET_HOURS = 3;

/**
 * Parses a trade's entry_date/entry_time (or exit_date/exit_time) into a
 * UTC epoch-seconds timestamp, given they're stored in the app's fixed
 * local timezone (see APP_LOCAL_OFFSET_HOURS above). Returns null if the
 * date is missing (exit fields are nullable for an open/manually
 * incomplete trade) or unparseable. entry_time/exit_time themselves are
 * also nullable (a trade logged with just a date) — defaults to midnight
 * local when absent, since a chart window needs *some* anchor point and
 * "start of that local day" is a reasonable one.
 */
export function tradeLocalToUtcSeconds(date: string | null, time: string | null): number | null {
  if (!date) return null;
  const timePart = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 8) : "00:00:00";
  const local = new Date(`${date}T${timePart}Z`); // parsed as if UTC, corrected below
  if (Number.isNaN(local.getTime())) return null;
  const utcMs = local.getTime() - APP_LOCAL_OFFSET_HOURS * 60 * 60 * 1000;
  return Math.floor(utcMs / 1000);
}

export type TradeChartWindow = {
  /** UTC epoch seconds for the trade's entry — always present if entry_date exists. */
  entryUtcSeconds: number | null;
  /** UTC epoch seconds for the trade's exit, if the trade has one. */
  exitUtcSeconds: number | null;
  /** Suggested fetch range start (UTC epoch seconds) — padded before entry. */
  rangeStartUtcSeconds: number;
  /** Suggested fetch range end (UTC epoch seconds) — padded after exit/entry, never beyond "now". */
  rangeEndUtcSeconds: number;
};

// How much padding to request around the trade's own entry/exit so the
// chart opens with visible context on both sides rather than the trade
// sitting flush against an edge. Expressed per-timeframe since a 1-minute
// chart needs a much narrower pad (a few hours) than a 1-day chart (a
// few weeks) to still look like "the trade's window" rather than the
// instrument's entire history.
const PAD_HOURS_BY_TIMEFRAME: Record<string, number> = {
  "1min": 4,
  "5min": 12,
  "15min": 24,
  "1h": 24 * 4,
  "4h": 24 * 14,
  "1day": 24 * 60,
};

/**
 * Computes the UTC fetch window a chart should request for a given trade
 * and timeframe, centered on the trade's entry (and extended to cover its
 * exit, if any) with timeframe-appropriate padding on both sides. The
 * caller (TradeChartModal) uses entryUtcSeconds/exitUtcSeconds to place
 * markers and to scroll the loaded chart to this range once data arrives.
 */
export function computeTradeChartWindow(trade: Trade, timeframe: string): TradeChartWindow | null {
  const entryUtcSeconds = tradeLocalToUtcSeconds(trade.entry_date, trade.entry_time);
  if (entryUtcSeconds === null) return null;
  const exitUtcSeconds = tradeLocalToUtcSeconds(trade.exit_date, trade.exit_time);

  const padSeconds = (PAD_HOURS_BY_TIMEFRAME[timeframe] ?? 24) * 60 * 60;
  const spanStart = entryUtcSeconds;
  const spanEnd = exitUtcSeconds !== null ? Math.max(exitUtcSeconds, entryUtcSeconds) : entryUtcSeconds;

  const nowSeconds = Math.floor(Date.now() / 1000);

  return {
    entryUtcSeconds,
    exitUtcSeconds,
    rangeStartUtcSeconds: spanStart - padSeconds,
    rangeEndUtcSeconds: Math.min(spanEnd + padSeconds, nowSeconds),
  };
}
