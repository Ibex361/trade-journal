import { describe, it, expect } from "vitest";
import { tradeLocalToUtcSeconds, computeTradeChartWindow } from "../chartTradeWindow";
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

describe("computeTradeChartWindow", () => {
  it("returns null when the trade has no entry_date", () => {
    const trade = makeTrade({ entry_date: "" });
    expect(computeTradeChartWindow(trade, "15min")).toBeNull();
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
});
