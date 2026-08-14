import { describe, it, expect } from "vitest";
import { tradeUtcDays, tradeUtcDaysWithContext, isUtcDayClosed, isCurrentUtcMonth, pgDateToString } from "../../scripts/tradeDays";

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

  it("returns an empty array if a raw Date object is passed instead of a string (documents why pgDateToString must run first)", () => {
    // tradeUtcDays/tradeLocalToUtcSeconds interpolate `date` into a
    // template string. A real "YYYY-MM-DD" string produces a parseable
    // ISO datetime; a raw Date object interpolates via .toString()
    // instead, which fails to parse. This test exists so that if
    // tradeUtcDays' signature is ever loosened to accept `string | Date`
    // without also fixing the interpolation, it fails loudly here
    // rather than silently dropping trades again the way it did before
    // sync-candles.ts started coercing with pgDateToString() first.
    const asDate = new Date(Date.UTC(2026, 7, 12)) as unknown as string;
    expect(tradeUtcDays(asDate, "10:50", null, null)).toEqual([]);
  });

  it("ignores an exit_date that's before entry_date (bad data) rather than producing a reversed or empty range", () => {
    // If exit somehow predates entry (shouldn't happen, but don't trust
    // it blindly), the trade is still treated as spanning at least its
    // entry day.
    expect(tradeUtcDays("2026-08-14", "10:00", "2026-08-10", "10:00")).toEqual(["2026-08-14"]);
  });
});

describe("tradeUtcDaysWithContext", () => {
  it("returns an empty array when entry_date is missing (same as tradeUtcDays)", () => {
    expect(tradeUtcDaysWithContext(null, "10:00", null, null)).toEqual([]);
  });

  it("adds 15 days of buffer before and after a same-day trade", () => {
    const days = tradeUtcDaysWithContext("2026-08-14", "10:00", null, null);
    expect(days[0]).toBe("2026-07-30"); // 2026-08-14 minus 15 days
    expect(days[days.length - 1]).toBe("2026-08-29"); // 2026-08-14 plus 15 days
    expect(days).toHaveLength(31); // 15 before + the trade day + 15 after
  });

  it("buffers on each side of a multi-day held trade's own span, not just its entry day", () => {
    const days = tradeUtcDaysWithContext("2026-08-10", "09:00", "2026-08-13", "17:00");
    expect(days[0]).toBe("2026-07-26"); // 2026-08-10 (first core day) minus 15
    expect(days[days.length - 1]).toBe("2026-08-28"); // 2026-08-13 (last core day) plus 15
    expect(days).toHaveLength(15 + 4 + 15); // 15 before + 4 core days + 15 after
  });

  it("is contiguous with no gaps or duplicates", () => {
    const days = tradeUtcDaysWithContext("2026-08-14", "10:00", null, null);
    const unique = new Set(days);
    expect(unique.size).toBe(days.length);
    for (let i = 1; i < days.length; i++) {
      const prev = new Date(`${days[i - 1]}T00:00:00Z`);
      prev.setUTCDate(prev.getUTCDate() + 1);
      expect(prev.toISOString().slice(0, 10)).toBe(days[i]);
    }
  });
});

describe("pgDateToString", () => {
  it("returns a string value unchanged", () => {
    expect(pgDateToString("2026-08-12")).toBe("2026-08-12");
  });

  it("returns null unchanged", () => {
    expect(pgDateToString(null)).toBe(null);
  });

  it("converts a native Date (what node-postgres actually returns for a `date` column) to a YYYY-MM-DD string", () => {
    // Regression test for the exact bug this exists to prevent: a raw
    // Date interpolated into a template string (as tradeLocalToUtcSeconds
    // does) calls .toString() instead of producing an ISO date, which
    // silently makes the whole trade vanish from the sync (tradeUtcDays
    // returns [] with no error) — this is what happened for a real
    // manually-entered trade before this coercion was added at the
    // pg-query boundary in sync-candles.ts.
    const asDate = new Date(Date.UTC(2026, 7, 12)); // 2026-08-12
    expect(pgDateToString(asDate)).toBe("2026-08-12");
  });

  it("pads single-digit month and day", () => {
    const asDate = new Date(Date.UTC(2026, 0, 5)); // 2026-01-05
    expect(pgDateToString(asDate)).toBe("2026-01-05");
  });

  it("a Date-derived string feeds correctly into tradeUtcDays, unlike the raw Date would", () => {
    const asDate = new Date(Date.UTC(2026, 7, 12));
    const dateString = pgDateToString(asDate);
    expect(tradeUtcDays(dateString, "10:50", dateString, "11:39")).toEqual(["2026-08-12"]);
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

describe("isCurrentUtcMonth", () => {
  it("returns true for the current UTC month", () => {
    const now = new Date("2026-08-14T15:00:00Z");
    expect(isCurrentUtcMonth("2026-08", now)).toBe(true);
  });

  it("returns false for a past month in the same year", () => {
    const now = new Date("2026-08-14T15:00:00Z");
    expect(isCurrentUtcMonth("2026-07", now)).toBe(false);
  });

  it("returns false for a past month across a year boundary", () => {
    const now = new Date("2026-01-05T00:00:00Z");
    expect(isCurrentUtcMonth("2025-12", now)).toBe(false);
  });

  it("returns false for a future month", () => {
    const now = new Date("2026-08-14T15:00:00Z");
    expect(isCurrentUtcMonth("2026-09", now)).toBe(false);
  });

  it("uses the UTC month even near a local-time month boundary", () => {
    // 2026-08-01T00:30:00Z is definitively August in UTC regardless of
    // any local timezone interpretation.
    const now = new Date("2026-08-01T00:30:00Z");
    expect(isCurrentUtcMonth("2026-08", now)).toBe(true);
    expect(isCurrentUtcMonth("2026-07", now)).toBe(false);
  });
});
