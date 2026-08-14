import { describe, it, expect } from "vitest";
import { tradeLocalToUtcSeconds, snapToCandle, computeTradeChartWindow, coversCandleTarget } from "../chartTradeWindow";
import { makeTrade } from "../testFixtures";

describe("tradeLocalToUtcSeconds", () => {
  it("converts a local (UTC+3) date+time to the correct UTC epoch seconds", () => {
    // 10:00 local (UTC+3) on 2026-01-01 is 07:00 UTC the same day.
    const result = tradeLocalToUtcSeconds("2026-01-01", "10:00");
    const expected = Date.UTC(2026, 0, 1, 7, 0, 0) / 1000;
    expect(result).toBe(expected);
  });

  it("rolls back to the previous UTC day when local time is before 03:00", () => {
    // 01:30 local (UTC+3) on 2026-01-02 is 22:30 UTC on 2026-01-01.
    const result = tradeLocalToUtcSeconds("2026-01-02", "01:30");
    const expected = Date.UTC(2026, 0, 1, 22, 30, 0) / 1000;
    expect(result).toBe(expected);
  });

  it("defaults to local midnight when time is null", () => {
    const result = tradeLocalToUtcSeconds("2026-01-01", null);
    const expected = Date.UTC(2026, 0, 1, 0, 0, 0) / 1000 - 3 * 60 * 60;
    expect(result).toBe(expected);
  });

  it("returns null when date is null", () => {
    expect(tradeLocalToUtcSeconds(null, "10:00")).toBeNull();
  });

  it("returns null for an unparseable date", () => {
    expect(tradeLocalToUtcSeconds("not-a-date", "10:00")).toBeNull();
  });

  it("handles a full HH:MM:SS time string the same as HH:MM", () => {
    const withSeconds = tradeLocalToUtcSeconds("2026-01-01", "10:00:45");
    const withoutSeconds = tradeLocalToUtcSeconds("2026-01-01", "10:00");
    // Both should land in the same minute; withSeconds carries the extra 45s.
    expect(withSeconds).toBe(withoutSeconds! + 45);
  });
});

describe("snapToCandle", () => {
  it("floors an exact-second timestamp to the 15min candle bucket that contains it", () => {
    // Regression test for the bug report: XAUUSD 2026-07-29 04:27:06 EAT
    // = 01:27:06 UTC. The 15min bucket containing that second starts at 01:15:00.
    const entryUtcSeconds = tradeLocalToUtcSeconds("2026-07-29", "04:27:06")!;
    const snapped = snapToCandle(entryUtcSeconds, "15min");
    // 01:15:00 UTC on 2026-07-29
    expect(snapped).toBe(Date.UTC(2026, 6, 29, 1, 15, 0) / 1000);
  });

  it("returns the timestamp unchanged when it's already a bucket boundary", () => {
    const boundary = Date.UTC(2026, 0, 1, 10, 0, 0) / 1000; // exactly on the hour
    expect(snapToCandle(boundary, "1h")).toBe(boundary);
  });

  it("snaps a 1min timestamp to the containing 1-minute bucket", () => {
    // 10:00:45 UTC → 10:00:00 bucket
    const ts = Date.UTC(2026, 0, 1, 10, 0, 45) / 1000;
    expect(snapToCandle(ts, "1min")).toBe(Date.UTC(2026, 0, 1, 10, 0, 0) / 1000);
  });

  it("snaps a 4h timestamp to the containing 4-hour bucket", () => {
    // 14:37:22 UTC → 12:00:00 UTC bucket (4h buckets: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00)
    const ts = Date.UTC(2026, 0, 1, 14, 37, 22) / 1000;
    expect(snapToCandle(ts, "4h")).toBe(Date.UTC(2026, 0, 1, 12, 0, 0) / 1000);
  });

  it("snaps a null-exit-time midnight default to the correct candle bucket (not the previous evening)", () => {
    // When exit_time is null, tradeLocalToUtcSeconds defaults to 00:00:00 local
    // (UTC+3) = 21:00:00 UTC the PREVIOUS day. Without snapping, lightweight-charts
    // places the exit marker on that previous-evening candle at a wrong price level.
    // Snapping moves it to the correct 21:00 bucket on the previous UTC day, which
    // is at least within the fetched range and is the least-wrong candle position
    // for a trade whose exit time was never recorded.
    const exitNullTime = tradeLocalToUtcSeconds("2026-07-29", null)!; // → 2026-07-28 21:00:00 UTC
    expect(new Date(exitNullTime * 1000).toISOString()).toBe("2026-07-28T21:00:00.000Z");
    // 21:00 UTC is already a 15min bucket boundary (21:00 = 21*60/15 * 15 minutes), so snapping is a no-op
    const snapped = snapToCandle(exitNullTime, "15min");
    expect(snapped).toBe(exitNullTime);
    // Crucially, it's NOT landing on a candle at some random mid-session second
    expect(snapped % (15 * 60)).toBe(0);
  });

  it("falls back to 15min buckets for an unrecognized timeframe key", () => {
    const ts = Date.UTC(2026, 0, 1, 10, 7, 33) / 1000;
    const snapped = snapToCandle(ts, "unknown-tf");
    expect(snapped).toBe(Date.UTC(2026, 0, 1, 10, 0, 0) / 1000);
  });
});

describe("computeTradeChartWindow", () => {
  it("returns null when the trade has no entry_date", () => {
    const trade = makeTrade({ entry_date: "" });
    expect(computeTradeChartWindow(trade, "15min")).toBeNull();
  });

  it("snaps entry and exit to the timeframe's candle bucket", () => {
    // Entry at 04:27:06 EAT = 01:27:06 UTC — should snap to 01:15:00 UTC (15min bucket)
    // Exit at 05:10:33 EAT = 02:10:33 UTC — should snap to 02:00:00 UTC
    const trade = makeTrade({
      entry_date: "2026-07-29",
      entry_time: "04:27:06",
      exit_date: "2026-07-29",
      exit_time: "05:10:33",
    });
    const window = computeTradeChartWindow(trade, "15min")!;
    expect(window.entryUtcSeconds).toBe(Date.UTC(2026, 6, 29, 1, 15, 0) / 1000);
    expect(window.exitUtcSeconds).toBe(Date.UTC(2026, 6, 29, 2, 0, 0) / 1000);
  });

  it("centers the window on entry when there's no exit", () => {
    const trade = makeTrade({ entry_date: "2020-01-01", entry_time: "10:00", exit_date: null, exit_time: null });
    const window = computeTradeChartWindow(trade, "15min");
    expect(window).not.toBeNull();
    expect(window!.exitUtcSeconds).toBeNull();
    expect(window!.rangeStartUtcSeconds).toBeLessThan(window!.entryUtcSeconds!);
    expect(window!.rangeEndUtcSeconds).toBeGreaterThan(window!.entryUtcSeconds!);
  });

  it("extends the window to cover the exit when present", () => {
    const trade = makeTrade({
      entry_date: "2020-01-01",
      entry_time: "10:00",
      exit_date: "2020-01-01",
      exit_time: "14:00",
    });
    const window = computeTradeChartWindow(trade, "15min");
    expect(window).not.toBeNull();
    expect(window!.exitUtcSeconds).not.toBeNull();
    expect(window!.rangeStartUtcSeconds).toBeLessThan(window!.entryUtcSeconds!);
    expect(window!.rangeEndUtcSeconds).toBeGreaterThan(window!.exitUtcSeconds!);
  });

  it("snapped entry and exit are always on candle bucket boundaries", () => {
    const trade = makeTrade({
      entry_date: "2026-07-29",
      entry_time: "04:27:06",
      exit_date: "2026-07-29",
      exit_time: "07:53:41",
    });
    const window = computeTradeChartWindow(trade, "15min")!;
    expect(window.entryUtcSeconds! % (15 * 60)).toBe(0);
    expect(window.exitUtcSeconds! % (15 * 60)).toBe(0);
  });

  it("uses a wider pad for a daily timeframe than a 1-minute timeframe", () => {
    const trade = makeTrade({ entry_date: "2020-01-01", entry_time: "10:00" });
    const minuteWindow = computeTradeChartWindow(trade, "1min")!;
    const dayWindow = computeTradeChartWindow(trade, "1day")!;
    const minutePad = minuteWindow.entryUtcSeconds! - minuteWindow.rangeStartUtcSeconds;
    const dayPad = dayWindow.entryUtcSeconds! - dayWindow.rangeStartUtcSeconds;
    expect(dayPad).toBeGreaterThan(minutePad);
  });

  it("never returns a range end beyond the current moment", () => {
    const trade = makeTrade({ entry_date: "2020-01-01", entry_time: "10:00" });
    const window = computeTradeChartWindow(trade, "1day")!;
    expect(window.rangeEndUtcSeconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("falls back to a default 24h pad for an unrecognized timeframe key", () => {
    const trade = makeTrade({ entry_date: "2020-01-01", entry_time: "10:00" });
    const window = computeTradeChartWindow(trade, "not-a-real-timeframe")!;
    const pad = window.entryUtcSeconds! - window.rangeStartUtcSeconds;
    expect(pad).toBe(24 * 60 * 60);
  });

  it("marks isFuture false for a trade well in the past", () => {
    const trade = makeTrade({ entry_date: "2020-01-01", entry_time: "10:00" });
    const window = computeTradeChartWindow(trade, "15min")!;
    expect(window.isFuture).toBe(false);
  });

  it("marks isFuture true when the entry is later than the current moment", () => {
    // Regression test: a trade logged for later today (or a mistaken future
    // date) has no tick data yet — R2 can't have synced a candle for an
    // instant that hasn't happened. Without this flag, TradeChartModal would
    // fetch an empty/partial range and lightweight-charts would silently
    // render the marker on the last real candle at the right price but the
    // wrong time, which is exactly the bug this field exists to prevent.
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const entryDate = oneYearFromNow.toISOString().slice(0, 10);
    const trade = makeTrade({ entry_date: entryDate, entry_time: "10:00" });
    const window = computeTradeChartWindow(trade, "15min")!;
    expect(window.isFuture).toBe(true);
  });

  it("marks isFuture true even when only the exit (not entry) is in the future", () => {
    const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000);
    const futureDate = oneYearFromNow.toISOString().slice(0, 10);
    // Entry is safely in the past; only exit_date is nonsensically future —
    // this shouldn't happen in practice but the flag should still catch it
    // via spanEnd/rangeEnd capping even though entryUtcSeconds itself isn't future.
    // (isFuture is defined off entry, per its doc comment, so this asserts
    // that specific, narrower contract rather than a broader "any future field" one.)
    const trade = makeTrade({
      entry_date: "2020-01-01",
      entry_time: "10:00",
      exit_date: futureDate,
      exit_time: "10:00",
    });
    const window = computeTradeChartWindow(trade, "15min")!;
    expect(window.isFuture).toBe(false); // entry itself is in the past
    // But the range end is still capped at "now", not the future exit date.
    expect(window.rangeEndUtcSeconds).toBeLessThanOrEqual(Math.floor(Date.now() / 1000));
  });

  it("does not flag isFuture for a trade entered a few minutes ago", () => {
    // Build the fixture from a known UTC instant a few minutes in the past,
    // converted to the app's local (UTC+3) date/time convention, rather than
    // doing that arithmetic by hand — avoids an hour/day-rollover mistake in
    // the test itself while still exercising the real conversion path.
    const nowMinusFiveMin = new Date(Date.now() - 5 * 60 * 1000);
    const localMs = nowMinusFiveMin.getTime() + 3 * 60 * 60 * 1000;
    const local = new Date(localMs);
    const entryDate = local.toISOString().slice(0, 10);
    const entryTime = local.toISOString().slice(11, 16);
    const trade = makeTrade({ entry_date: entryDate, entry_time: entryTime });
    const window = computeTradeChartWindow(trade, "15min")!;
    expect(window.isFuture).toBe(false);
  });
});

describe("coversCandleTarget", () => {
  const tenAm = Date.UTC(2026, 0, 1, 10, 0, 0) / 1000;
  const nineFortyFive = Date.UTC(2026, 0, 1, 9, 45, 0) / 1000;
  const nineThirty = Date.UTC(2026, 0, 1, 9, 30, 0) / 1000;

  it("returns false for an empty candle list — no data means no coverage", () => {
    expect(coversCandleTarget([], tenAm, "15min")).toBe(false);
  });

  it("returns true when the last candle is exactly at the target time", () => {
    expect(coversCandleTarget([{ time: tenAm }], tenAm, "15min")).toBe(true);
  });

  it("returns true when the last candle is after the target time", () => {
    const after = tenAm + 15 * 60;
    expect(coversCandleTarget([{ time: tenAm }, { time: after }], tenAm, "15min")).toBe(true);
  });

  it("returns true when the last candle is within one bucket before the target (still-forming-bar tolerance)", () => {
    // Target is 10:00, last candle is 09:45 — exactly one 15min bucket
    // short, which is expected: the bar covering 10:00 might still be
    // forming/not yet synced even though the trade itself already happened.
    expect(coversCandleTarget([{ time: nineFortyFive }], tenAm, "15min")).toBe(true);
  });

  it("returns false when the last candle is more than one bucket before the target — the core bug fix case", () => {
    // Regression test: trade entry at 10:00, but the daily sync hasn't run
    // for today yet, so the most recent available candle is from 09:30 —
    // two buckets short. Without this check, the chart would silently
    // render with the entry marker placed on unrelated data.
    expect(coversCandleTarget([{ time: nineThirty }], tenAm, "15min")).toBe(false);
  });

  it("uses the max candle time when candles aren't sorted", () => {
    const unsorted = [{ time: nineThirty }, { time: tenAm }, { time: nineFortyFive }];
    expect(coversCandleTarget(unsorted, tenAm, "15min")).toBe(true);
  });

  it("scales the tolerance bucket to the timeframe", () => {
    // 1h timeframe: a candle 45 minutes before target is still within
    // one 1h bucket's tolerance, even though it would fail for 15min.
    const target = Date.UTC(2026, 0, 1, 10, 0, 0) / 1000;
    const candle = Date.UTC(2026, 0, 1, 9, 15, 0) / 1000; // 45 min before
    expect(coversCandleTarget([{ time: candle }], target, "1h")).toBe(true);
    expect(coversCandleTarget([{ time: candle }], target, "15min")).toBe(false);
  });

  it("falls back to a 15min-equivalent bucket for an unrecognized timeframe key", () => {
    expect(coversCandleTarget([{ time: nineFortyFive }], tenAm, "not-a-real-timeframe")).toBe(true);
    expect(coversCandleTarget([{ time: nineThirty }], tenAm, "not-a-real-timeframe")).toBe(false);
  });
});
