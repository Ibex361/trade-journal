import { Trade } from "./trades";
import { TIMEFRAMES_MINUTES } from "../scripts/candleAggregation";

// entry_date/entry_time (and exit_date/exit_time) are stored as East
// Africa Time (UTC+3) calendar values — see exnessImport.ts's
// EXNESS_TO_LOCAL_OFFSET_HOURS comment, which documents that both
// imported and manually-entered trades use this same local convention
// consistently. The offset is what lets a trade's stored local time
// convert back to the correct UTC instant — it is NOT a generic "current
// browser timezone" guess, it is this app's one fixed data convention.
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
 *
 * NOTE: when time is null, the returned seconds point to local midnight
 * (21:00 UTC the previous day for UTC+3). Callers that use this for
 * marker placement MUST snap the result to the candle bucket via
 * snapToCandle() — otherwise a null exit_time places the exit marker on
 * a candle from the previous evening rather than somewhere near the
 * trade's actual exit. snapToCandle is in this module.
 */
export function tradeLocalToUtcSeconds(date: string | null, time: string | null): number | null {
  if (!date) return null;
  const timePart = time && /^\d{2}:\d{2}/.test(time) ? time.slice(0, 8) : "00:00:00";
  const local = new Date(`${date}T${timePart}Z`); // parsed as if UTC, corrected below
  if (Number.isNaN(local.getTime())) return null;
  const utcMs = local.getTime() - APP_LOCAL_OFFSET_HOURS * 60 * 60 * 1000;
  return Math.floor(utcMs / 1000);
}

/**
 * Snaps a UTC epoch-seconds timestamp to the start of the candle bucket
 * that contains it for the given timeframe. This is required for marker
 * placement because lightweight-charts' createSeriesMarkers matches
 * markers to series bars by exact time value — if marker.time doesn't
 * equal any candle's time, the library snaps to the nearest bar, which
 * can be the WRONG bar (wrong price level, wrong visual position).
 *
 * Two failure modes this prevents:
 *
 * 1. Exact-second mismatch: marker at 01:27:06 UTC, nearest 15m candle
 *    is 01:15:00 — snapping gives the correct 01:15:00 candle every time.
 *
 * 2. Null exit_time: tradeLocalToUtcSeconds defaults to local midnight
 *    (00:00:00 EAT = 21:00:00 UTC the PREVIOUS day). Without snapping,
 *    the exit marker lands on a candle from the evening before the trade,
 *    at a completely different price level — which is what the bug report
 *    showed (exit marker at ~4111 visually appearing near 4030).
 *    Snapping moves it to the 21:00 candle bucket, which is at least
 *    within the fetched range and is the least-wrong position for a trade
 *    whose exit time was never recorded.
 */
export function snapToCandle(utcSeconds: number, timeframe: string): number {
  const minutes = TIMEFRAMES_MINUTES[timeframe] ?? 15;
  const bucketSeconds = minutes * 60;
  return Math.floor(utcSeconds / bucketSeconds) * bucketSeconds;
}

export type TradeChartWindow = {
  /** UTC epoch seconds for the trade's entry, snapped to the current timeframe's candle bucket. */
  entryUtcSeconds: number | null;
  /** UTC epoch seconds for the trade's exit, snapped to the current timeframe's candle bucket. */
  exitUtcSeconds: number | null;
  /** Suggested fetch range start (UTC epoch seconds) — padded before entry. */
  rangeStartUtcSeconds: number;
  /** Suggested fetch range end (UTC epoch seconds) — padded after exit/entry, never beyond "now". */
  rangeEndUtcSeconds: number;
  /**
   * True when the trade's entry (or exit) time is later than the current
   * moment — e.g. a trade logged for later today, or a wrong AM/PM or
   * date entered by mistake. No tick data can exist yet for a future
   * instant, so there's no candle for a marker to attach to. The R2
   * archive's most recent candle is always for a moment strictly before
   * "now" (see sync-candles.ts's daily sync cadence), so a marker for a
   * future instant would otherwise silently render on whatever the last
   * real candle happens to be — at the right price (thanks to
   * atPriceMiddle) but the wrong time, which looks like the exact bug
   * this field exists to catch. Callers should show a clear message
   * instead of attempting to plot markers when this is true.
   */
  isFuture: boolean;
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
 * exit, if any) with timeframe-appropriate padding on both sides.
 *
 * entryUtcSeconds and exitUtcSeconds are snapped to the containing candle
 * bucket for the given timeframe (see snapToCandle above) so that marker
 * placement in TradeChartModal always hits an actual candle rather than
 * a phantom timestamp between bars.
 */
export function computeTradeChartWindow(trade: Trade, timeframe: string): TradeChartWindow | null {
  const entryRaw = tradeLocalToUtcSeconds(trade.entry_date, trade.entry_time);
  if (entryRaw === null) return null;
  const exitRaw = tradeLocalToUtcSeconds(trade.exit_date, trade.exit_time);

  // Snap both to candle bucket so marker.time == an actual candle.time
  const entryUtcSeconds = snapToCandle(entryRaw, timeframe);
  const exitUtcSeconds = exitRaw !== null ? snapToCandle(exitRaw, timeframe) : null;

  const padSeconds = (PAD_HOURS_BY_TIMEFRAME[timeframe] ?? 24) * 60 * 60;
  const spanEnd = exitUtcSeconds !== null ? Math.max(exitUtcSeconds, entryUtcSeconds) : entryUtcSeconds;

  const nowSeconds = Math.floor(Date.now() / 1000);
  // The entry itself (not just the padded span) is what determines
  // whether this trade can be charted at all — even the exact entry
  // instant has no tick data yet if it's in the future. Snapped values
  // are compared against a same-timeframe snap of "now" so a trade
  // snapped to, say, the 16:00 bucket isn't flagged future just because
  // "now" is 15:59:40 and hasn't reached that bucket's raw boundary yet.
  const nowSnapped = snapToCandle(nowSeconds, timeframe);
  const isFuture = entryUtcSeconds > nowSnapped;

  return {
    entryUtcSeconds,
    exitUtcSeconds,
    rangeStartUtcSeconds: entryUtcSeconds - padSeconds,
    rangeEndUtcSeconds: Math.min(spanEnd + padSeconds, nowSeconds),
    isFuture,
  };
}
