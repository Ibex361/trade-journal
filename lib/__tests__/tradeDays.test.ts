import { describe, it, expect } from "vitest";
import { tradeUtcDays, isUtcDayClosed } from "../../scripts/tradeDays";

describe("tradeUtcDays", () => {
  it("returns a single UTC day for a same-day trade with no exit", () => {
    // Entry 10:00 EAT = 07:00 UTC — well inside the same UTC day.
    expect(tradeUtcDays("2026-08-14", "10:00", null, null)).toEqual(["2026-08-14"]);
  });

  it("returns a single UTC day for a same-day trade with entry and exit", () => {
    expect(tradeUtcDays("2026-08-14", "10:00", "2026-08-14", "14:00")).toEqual(["2026-08-14"]);
  });

  it("returns an empty array when entry_date is missing", () => {
    expect(tradeUtcDays(null, "10:00", null, null)).toEqual([]);
  });

  it("returns an empty array when entry_date is unparseable", () => {
    expect(tradeUtcDays("not-a-date", "10:00", null, null)).toEqual([]);
  });

  it("crosses into the previous UTC day when local entry time is before 03:00 EAT", () => {
    // Local 2026-08-14 01:30 EAT = 2026-08-13 22:30 UTC — the trade
    // actually happened on the UTC-previous day, even though its
    // stored local entry_date says 08-14. This is the exact boundary
    // case tradeLocalToUtcSeconds exists to get right.
    expect(tradeUtcDays("2026-08-14", "01:30", null, null)).toEqual(["2026-08-13"]);
  });

  it("spans multiple UTC days for a trade held overnight", () => {
    // Entry 2026-08-14 23:30 EAT (= 08-14 20:30 UTC), exit 2026-08-15
    // 08:00 EAT (= 08-15 05:00 UTC) — spans two UTC calendar days.
    expect(tradeUtcDays("2026-08-14", "23:30", "2026-08-15", "08:00")).toEqual(["2026-08-14", "2026-08-15"]);
  });

  it("spans every UTC day in a multi-day held trade, inclusive", () => {
    expect(tradeUtcDays("2026-08-10", "09:00", "2026-08-13", "17:00")).toEqual([
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
  });

  it("treats a trade with no exit_date as spanning only its entry day", () => {
    expect(tradeUtcDays("2026-08-14", "10:00", null, null)).toEqual(["2026-08-14"]);
  });

  it("falls back to the entry day when exit_date is present but exit_time is missing (midnight local default)", () => {
    // exit_date same as entry_date, exit_time null -> tradeLocalToUtcSeconds
    // defaults exit to local midnight, which is BEFORE entry's 10:00 EAT
    // same-day time -- so endUtcSeconds should stay clamped to entry,
    // not regress to an earlier UTC day than the entry itself.
    expect(tradeUtcDays("2026-08-14", "10:00", "2026-08-14", null)).toEqual(["2026-08-14"]);
  });

  it("handles an exit_date without a matching entry crossing a month boundary", () => {
    expect(tradeUtcDays("2026-07-30", "12:00", "2026-08-02", "12:00")).toEqual([
      "2026-07-30",
      "2026-07-31",
      "2026-08-01",
      "2026-08-02",
    ]);
  });

  it("handles a trade spanning a year boundary", () => {
    expect(tradeUtcDays("2025-12-30", "12:00", "2026-01-02", "12:00")).toEqual([
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("ignores an exit_date that's before entry_date (bad data) rather than producing a reversed or empty range", () => {
    // If exit somehow predates entry (shouldn't happen, but don't trust
    // it blindly), the trade is still treated as spanning at least its
    // entry day.
    expect(tradeUtcDays("2026-08-14", "10:00", "2026-08-10", "10:00")).toEqual(["2026-08-14"]);
  });
});

describe("isUtcDayClosed", () => {
  it("returns false for the current UTC day (still in progress)", () => {
    const now = new Date("2026-08-14T15:00:00Z");
    expect(isUtcDayClosed("2026-08-14", now)).toBe(false);
  });

  it("returns true for a day that fully ended before now", () => {
    const now = new Date("2026-08-14T15:00:00Z");
    expect(isUtcDayClosed("2026-08-13", now)).toBe(true);
  });

  it("returns true exactly at the boundary — 00:00:00 UTC the next day", () => {
    const now = new Date("2026-08-14T00:00:00.000Z");
    expect(isUtcDayClosed("2026-08-13", now)).toBe(true);
  });

  it("returns false one millisecond before the boundary", () => {
    const now = new Date("2026-08-13T23:59:59.999Z");
    expect(isUtcDayClosed("2026-08-13", now)).toBe(false);
  });

  it("returns false for a future day", () => {
    const now = new Date("2026-08-14T15:00:00Z");
    expect(isUtcDayClosed("2026-08-20", now)).toBe(false);
  });
});
