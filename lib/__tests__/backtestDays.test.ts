import { describe, it, expect } from "vitest";
import { backtestUtcDays } from "../../scripts/backtestDays";

// backtestUtcDays pads the declared [startDate, endDate] range by 33
// days on each side (CHART_PADDING_BUFFER_DAYS in backtestDays.ts) so
// trade charts near either edge of a run have real synced data — see
// that constant's doc comment for the exact math. Every "inclusive of
// both ends" test below has to account for that padding, not just the
// bare declared range.
const BUFFER_DAYS = 33;

describe("backtestUtcDays", () => {
  it("returns an empty array when startDate or endDate is missing", () => {
    expect(backtestUtcDays(null, "2026-01-05")).toEqual([]);
    expect(backtestUtcDays("2026-01-01", null)).toEqual([]);
    expect(backtestUtcDays(null, null)).toEqual([]);
  });

  it("returns an empty array for unparseable dates", () => {
    expect(backtestUtcDays("not-a-date", "2026-01-05")).toEqual([]);
  });

  it("returns an empty array when start is after end", () => {
    expect(backtestUtcDays("2026-01-10", "2026-01-05")).toEqual([]);
  });

  it("returns every day inclusive of both ends plus the padding buffer, when all are already closed", () => {
    const now = new Date("2026-06-01T00:00:00Z"); // well after the range below
    const days = backtestUtcDays("2026-01-01", "2026-01-05", now);
    expect(days[0]).toBe("2025-11-29"); // 2026-01-01 minus 33 days
    expect(days[days.length - 1]).toBe("2026-02-07"); // 2026-01-05 plus 33 days
    expect(days).toHaveLength(5 + 2 * BUFFER_DAYS);
    // still every day in between, contiguous and deduped
    expect(days).toEqual([...new Set(days)]);
    expect(days).toContain("2026-01-01");
    expect(days).toContain("2026-01-05");
  });

  it("returns start..end plus the buffer on each side, when start equals end", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    const days = backtestUtcDays("2026-01-01", "2026-01-01", now);
    expect(days[0]).toBe("2025-11-29");
    expect(days[days.length - 1]).toBe("2026-02-03");
    expect(days).toHaveLength(1 + 2 * BUFFER_DAYS);
  });

  it("excludes days that haven't fully closed yet as of `now`, including in the forward buffer", () => {
    // "now" is midday on 2026-01-03 — 2026-01-03 itself, and everything
    // in the forward padding buffer past end_date, hasn't closed (UTC
    // midnight boundary hasn't passed), so the range should stop at
    // 2026-01-02, same isUtcDayClosed semantics as the live-trade sync.
    // The backward buffer (well before "now") is unaffected.
    const now = new Date("2026-01-03T12:00:00Z");
    const days = backtestUtcDays("2026-01-01", "2026-01-05", now);
    expect(days[0]).toBe("2025-11-29"); // backward buffer, already closed
    expect(days[days.length - 1]).toBe("2026-01-02"); // clipped by isUtcDayClosed
    expect(days).not.toContain("2026-01-03");
  });

  it("returns an empty array when the entire padded range is still in the future", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    expect(backtestUtcDays("2026-01-01", "2026-01-05", now)).toEqual([]);
  });

  it("a trade entered right at start_date, or exited right at end_date, falls inside the padded range", () => {
    // Regression test for the actual bug: PAD_HOURS_BY_TIMEFRAME["1day"]
    // (60h) + EMA_SEED_CANDLES (30 candles * 1 day) = 32.5 days of chart
    // lookback before an entry — a trade entered exactly on start_date
    // needs candles as far back as 2026-01-01 minus 32.5 days, which the
    // buffer must cover.
    const now = new Date("2026-06-01T00:00:00Z");
    const days = backtestUtcDays("2026-01-01", "2026-01-05", now);
    const neededForEntryChart = "2025-11-29"; // 2026-01-01 - 33d, >= the 32.5d actually needed
    const neededForExitChart = "2026-02-07"; // 2026-01-05 + 33d
    expect(days).toContain(neededForEntryChart);
    expect(days).toContain(neededForExitChart);
  });
});
