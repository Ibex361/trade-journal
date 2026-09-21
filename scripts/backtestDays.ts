// scripts/backtestDays.ts
//
// Pure logic for computing which UTC calendar days a BACKTEST run's own
// date range needs candle data for — the backtest-bucket analogue of
// tradeDays.ts's tradeUtcDaysWithContext, but driven by an explicit
// start/end date range (what a backtest run declares up front) rather
// than a single trade's entry/exit timestamps.
//
// Kept in its own file (not added to tradeDays.ts) since it has nothing
// to do with a *trade's* entry/exit — a backtest range is a user-chosen
// window with no notion of "entry local time", "exit local time", or a
// context buffer around a point event. The two files share the same
// underlying day-closed check (isUtcDayClosed, imported from
// tradeDays.ts) so "never fetch a still-forming day" stays one single
// source of truth across both the live-trade and backtest sync scripts.

import { isUtcDayClosed } from "./tradeDays";

/**
 * Every UTC calendar day ("YYYY-MM-DD") from startDate through endDate,
 * inclusive on both ends, that has ALSO fully closed as of `now` —
 * mirrors tradeUtcDaysWithContext's "no partial-day data" guarantee,
 * applied to a plain date range instead of a trade's own span. A
 * backtest whose end_date is today or in the future simply gets fewer
 * days back than requested; the missing tail is naturally picked up by
 * a later sync run once those days close, exactly like a live trade
 * whose exit hasn't happened yet.
 *
 * startDate/endDate are "YYYY-MM-DD" strings (the same shape a <input
 * type="date"> gives the New Backtest form, and the same shape
 * backtest_runs.start_date/end_date round-trip as from Postgres via
 * pgDateToString at the call site). Returns [] if either is missing,
 * unparseable, or start is after end.
 */
export function backtestUtcDays(startDate: string | null, endDate: string | null, now: Date = new Date()): string[] {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (start.getTime() > end.getTime()) return [];

  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.toISOString().slice(0, 10);
    if (isUtcDayClosed(day, now)) days.push(day);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
