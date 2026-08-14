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
