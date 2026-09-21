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
// window with no notion of "entry local time" or "exit local time" (it
// IS padded on both ends for chart-context reasons, see
// CHART_PADDING_BUFFER_DAYS below, but that's a flat buffer on the
// whole range, not a per-trade one). The two files share the same
// underlying day-closed check (isUtcDayClosed, imported from
// tradeDays.ts) so "never fetch a still-forming day" stays one single
// source of truth across both the live-trade and backtest sync scripts.

import { isUtcDayClosed } from "./tradeDays";

// How many extra calendar days to sync BEFORE start_date and AFTER
// end_date, on top of the run's own declared range — so a backtest
// trade's chart (TradeChartModal, same component the live trades page
// uses) has real synced candles under it instead of gaps.
//
// This exists because the chart doesn't just show the run's declared
// range: computeTradeChartWindow (lib/chartTradeWindow.ts) pads AROUND
// each individual trade's own entry/exit by a timeframe-dependent
// amount (PAD_HOURS_BY_TIMEFRAME), then requests EMA_SEED_CANDLES (30)
// more candle-widths on top of that for the EMA overlay — and a trade
// entered near the very start of the run's range (or exited near the
// very end) needs that padding to reach backward/forward past the
// range boundary. Without a buffer here, the backtest sync only ever
// fetches exactly [start_date, end_date] (see the module doc comment
// above / sync-backtest-candles.ts), so a trade near either edge shows
// missing or oddly-truncated candles and awkward navigation — the chart
// is asking for a window the sync never fetched.
//
// The worst case is the "1day" timeframe: PAD_HOURS_BY_TIMEFRAME["1day"]
// = 60 hours (2.5 days) plus EMA_SEED_CANDLES * 1-day candle width = 30
// days, i.e. 32.5 days of lookback before a trade's entry. 33 rounds
// that up with a whole day of slack. (The live-trade sync's analogous
// CHART_CONTEXT_BUFFER_DAYS, in tradeDays.ts, is 30 for the same reason
// but computed before the EMA feature existed — kept separate here
// rather than importing it, since the two buffers protect different
// call sites and 30 alone is 2.5 days short of covering the 1day+EMA
// case reliably.) Applied on both ends since a trade's exit can pad
// forward past end_date the same way an entry pads backward past
// start_date.
const CHART_PADDING_BUFFER_DAYS = 33;

/**
 * Every UTC calendar day ("YYYY-MM-DD") from startDate through endDate
 * — widened by CHART_PADDING_BUFFER_DAYS on each end so trade charts
 * near either edge have real data (see the constant's doc comment) —
 * that has ALSO fully closed as of `now`. Mirrors
 * tradeUtcDaysWithContext's "no partial-day data" guarantee, applied to
 * a plain date range instead of a trade's own span. A backtest whose
 * end_date (or its padded tail) is today or in the future simply gets
 * fewer days back than requested; the missing tail is naturally picked
 * up by a later sync run once those days close, exactly like a live
 * trade whose exit hasn't happened yet.
 *
 * startDate/endDate are "YYYY-MM-DD" strings (the same shape a <input
 * type="date"> gives the New Backtest form, and the same shape
 * backtest_runs.start_date/end_date round-trip as from Postgres via
 * pgDateToString at the call site) — they identify the run's own
 * declared range, NOT the padded fetch range; the padding is applied
 * internally and is not reflected back to the caller. Returns [] if
 * either is missing, unparseable, or start is after end.
 */
export function backtestUtcDays(startDate: string | null, endDate: string | null, now: Date = new Date()): string[] {
  if (!startDate || !endDate) return [];
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
  if (start.getTime() > end.getTime()) return [];

  start.setUTCDate(start.getUTCDate() - CHART_PADDING_BUFFER_DAYS);
  end.setUTCDate(end.getUTCDate() + CHART_PADDING_BUFFER_DAYS);

  const days: string[] = [];
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    const day = cursor.toISOString().slice(0, 10);
    if (isUtcDayClosed(day, now)) days.push(day);
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
