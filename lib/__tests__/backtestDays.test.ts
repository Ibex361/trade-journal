import { describe, it, expect } from "vitest";
import { backtestUtcDays } from "../../scripts/backtestDays";

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

  it("returns every day inclusive of both ends, when all are already closed", () => {
    const now = new Date("2026-06-01T00:00:00Z"); // well after the range below
    const days = backtestUtcDays("2026-01-01", "2026-01-05", now);
    expect(days).toEqual(["2026-01-01", "2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"]);
  });

  it("returns a single day when start equals end", () => {
    const now = new Date("2026-06-01T00:00:00Z");
    expect(backtestUtcDays("2026-01-01", "2026-01-01", now)).toEqual(["2026-01-01"]);
  });

  it("excludes days that haven't fully closed yet as of `now`", () => {
    // "now" is midday on 2026-01-03 — 2026-01-03 itself hasn't closed
    // (UTC midnight boundary hasn't passed), so the range should stop at
    // 2026-01-02, same isUtcDayClosed semantics as the live-trade sync.
    const now = new Date("2026-01-03T12:00:00Z");
    const days = backtestUtcDays("2026-01-01", "2026-01-05", now);
    expect(days).toEqual(["2026-01-01", "2026-01-02"]);
  });

  it("returns an empty array when the entire range is still in the future", () => {
    const now = new Date("2025-01-01T00:00:00Z");
    expect(backtestUtcDays("2026-01-01", "2026-01-05", now)).toEqual([]);
  });
});
