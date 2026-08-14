// scripts/tradeDays.ts
//
// Pure logic for computing which UTC calendar days a trade's tick data
// actually needs to be fetched for. Extracted from sync-candles.ts (same
// reasoning as candleAggregation.ts: keeps this testable in isolation
// from that script's env-var/S3-client/Postgres side effects).
//
// This replaces the old month-range backfill strategy entirely: instead
// of downloading a whole month's tick archive per instrument and
// re-fetching the current month on every run, the sync now fetches only
// the individual UTC calendar days a real logged trade actually touched
// — see .github/workflows/sync-candles.yml's header comment for the
// full rationale (dropped: monthly zip downloads; there is no "Monthly"
// chart timeframe, so a whole month of ticks was always more than any
// chart could ever need).

import { tradeLocalToUtcSeconds } from "../lib/chartTradeWindow";

/** "YYYY-MM-DD" for the UTC calendar day containing the given UTC epoch seconds. */
function utcDateString(utcSeconds: number): string {
  return new Date(utcSeconds * 1000).toISOString().slice(0, 10);
}

/**
 * node-postgres returns a Postgres `date` column as a native JS Date
 * object at runtime, regardless of what a query result's TS type
 * annotation claims. tradeUtcDays() (below) expects entry_date/exit_date
 * as plain "YYYY-MM-DD" strings — every other caller reaches it via the
 * Supabase JS client, which serializes `date` columns as strings, so
 * this mismatch never surfaced until sync-candles.ts started querying
 * Postgres directly via `pg`. Interpolating a raw Date into a template
 * string calls its .toString() instead of producing "YYYY-MM-DDT...",
 * which the underlying `new Date(...)` parse silently fails on —
 * tradeLocalToUtcSeconds returns null, tradeUtcDays returns [], and the
 * trade vanishes from the sync with no error at all. Any caller
 * reading entry_date/exit_date from a raw `pg` query result MUST run it
 * through this first. `time` columns (entry_time/exit_time) are NOT
 * affected — pg returns those as strings already ("HH:MM:SS").
 */
export function pgDateToString(value: string | Date | null): string | null {
  if (value === null) return null;
  if (!(value instanceof Date)) return value;
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Every distinct UTC calendar day ("YYYY-MM-DD") a trade's tick data
 * actually needs to be fetched for, spanning entry through exit
 * inclusive.
 *
 * entry_date/entry_time (and exit_date/exit_time) are stored as East
 * Africa Time (UTC+3) local calendar values (see tradeLocalToUtcSeconds
 * in lib/chartTradeWindow.ts), but the Exness archive is keyed by UTC
 * calendar day. A local EAT calendar day does NOT map 1:1 onto a UTC
 * calendar day — e.g. a trade logged as local 2026-08-14 at 01:30 EAT
 * actually happened at 2026-08-13 22:30 UTC, so naively trusting
 * entry_date/exit_date literally would fetch the wrong day (or, for a
 * trade near the boundary, miss the day that actually has the ticks).
 * Converting through tradeLocalToUtcSeconds first — the same conversion
 * TradeChartModal already uses for marker placement — is what makes
 * this correct and keeps the local→UTC offset defined in exactly one
 * place in the codebase.
 *
 * exit_date/exit_time are nullable (an incomplete/manually-partial
 * trade log) — when absent, the trade is treated as spanning only its
 * entry day, since that's the one UTC day known for certain to contain
 * relevant ticks.
 *
 * Returns an empty array if entry_date itself is missing/unparseable
 * (mirrors tradeLocalToUtcSeconds returning null for that case) — the
 * caller should simply skip a trade that can't be dated at all rather
 * than treating it as an error, same as computeTradeChartWindow's own
 * null-return convention in chartTradeWindow.ts.
 */
export function tradeUtcDays(entryDate: string | null, entryTime: string | null, exitDate: string | null, exitTime: string | null): string[] {
  const entryUtcSeconds = tradeLocalToUtcSeconds(entryDate, entryTime);
  if (entryUtcSeconds === null) return [];

  const exitUtcSeconds = tradeLocalToUtcSeconds(exitDate, exitTime);
  const endUtcSeconds = exitUtcSeconds !== null && exitUtcSeconds > entryUtcSeconds ? exitUtcSeconds : entryUtcSeconds;

  const startDay = utcDateString(entryUtcSeconds);
  const endDay = utcDateString(endUtcSeconds);

  if (startDay === endDay) return [startDay];

  // Walk day-by-day from startDay through endDay inclusive. Trades
  // span at most a handful of days in practice (this is a discretionary
  // trading journal, not a multi-week swing-trade log), so a simple
  // day-at-a-time loop is clearer than date-arithmetic shortcuts and
  // there's no performance concern at this scale.
  const days: string[] = [];
  const cursor = new Date(`${startDay}T00:00:00Z`);
  const end = new Date(`${endDay}T00:00:00Z`);
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

// How many calendar days of buffer to sync on each side of a trade's own
// entry->exit span, so the 1day chart (60-day pad, see
// PAD_HOURS_BY_TIMEFRAME in lib/chartTradeWindow.ts) has real candles to
// show around the trade instead of a gap. Deliberately much smaller than
// the chart's 60-day pad -- this is "enough days to not look broken
// close to the trade," not an attempt to fill the whole padded window,
// which would defeat the point of a trade-scoped sync.
const CHART_CONTEXT_BUFFER_DAYS = 15;

/**
 * tradeUtcDays(), extended by CHART_CONTEXT_BUFFER_DAYS calendar days on
 * each side of the trade's own entry->exit span. Used by sync-candles.ts
 * instead of tradeUtcDays() directly so the daily chart always has some
 * real context around a trade rather than only ever having candles for
 * the exact day(s) traded.
 *
 * The "after" side is naturally clamped to however many buffer days are
 * actually available before `now` -- e.g. a trade from 5 days ago only
 * gets 5 "after" days, not 15, since the other 10 haven't happened yet.
 * No special-casing needed for this: isUtcDayClosed() (already applied
 * by the caller, computeInstrumentDays) filters out any day that hasn't
 * closed yet, which is exactly "days that don't exist yet" for a recent
 * trade. Days before the trade's entry are never clamped this way since
 * the past is always available.
 *
 * Returns an empty array under the same condition tradeUtcDays() does
 * (entry_date missing/unparseable) -- there's no core span to buffer
 * around in that case.
 */
export function tradeUtcDaysWithContext(entryDate: string | null, entryTime: string | null, exitDate: string | null, exitTime: string | null): string[] {
  const coreDays = tradeUtcDays(entryDate, entryTime, exitDate, exitTime);
  if (coreDays.length === 0) return [];

  const firstCoreDay = new Date(`${coreDays[0]}T00:00:00Z`);
  const lastCoreDay = new Date(`${coreDays[coreDays.length - 1]}T00:00:00Z`);

  const start = new Date(firstCoreDay);
  start.setUTCDate(start.getUTCDate() - CHART_CONTEXT_BUFFER_DAYS);

  const end = new Date(lastCoreDay);
  end.setUTCDate(end.getUTCDate() + CHART_CONTEXT_BUFFER_DAYS);

  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

/**
 * True if the given UTC calendar day ("YYYY-MM-DD") has fully closed as
 * of `now` — i.e. `now` is at or past the start of the NEXT UTC day.
 * This is the check that enforces "never fetch a day's archive file
 * before that day is fully formed": Exness's per-day tick archive for a
 * still-in-progress UTC day is necessarily incomplete (it only contains
 * ticks published so far), and unlike the old design, this pipeline no
 * longer tries to work around that with a partial-day fetch-and-append
 * — it simply waits until the day is over, then fetches it exactly
 * once, complete.
 */
export function isUtcDayClosed(day: string, now: Date = new Date()): boolean {
  const dayEndUtcMs = new Date(`${day}T00:00:00Z`).getTime() + 24 * 60 * 60 * 1000;
  return now.getTime() >= dayEndUtcMs;
}

/**
 * True if "YYYY-MM" is the current UTC calendar month as of `now`.
 *
 * This is the boundary sync-candles.ts uses to decide which archive
 * URL shape to fetch: Exness only publishes a DAILY per-day archive
 * file for the month that's still in progress. Once a month closes,
 * Exness stops publishing per-day files for it entirely — only a
 * single MONTHLY archive remains available (a different URL, with no
 * /dd/ path segment and no _dd suffix). A day-shaped fetch against a
 * past month's date 404s for every single day of that month, which is
 * exactly what surfaced this: real, valid trade-days from a prior
 * month (e.g. mid-July while the current month was August) were being
 * logged as "no archive file" and silently skipped, even though
 * Exness has that data — just under the monthly path, not the daily
 * one. sync-candles.ts fetches the current month's needed days via
 * fetchDayTickCsv (daily URL) and every other month's needed days via
 * fetchMonthTickCsv (monthly URL), grouped by month so a month with
 * several needed trade-days only downloads its one archive once.
 */
export function isCurrentUtcMonth(month: string, now: Date = new Date()): boolean {
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  return month === currentMonth;
}
