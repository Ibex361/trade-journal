import { describe, it, expect } from "vitest";
import {
  getTradesInCurrentMonth,
  getPnlByPeriod,
  getPerformanceByHour,
  getTradesInHourBucket,
  countMissingTimeOfDay,
  getPerformanceByHoldingTime,
  getTradesInHoldingTimeBucket,
  countMissingHoldingTime,
  getTradesInMonth,
  getDailyPnlForMonth,
  getBestWorstDay,
  getBestWorstTrade,
  getTradeRowEmphasis,
} from "../time";
import { makeTrade } from "../../testFixtures";

describe("getTradesInCurrentMonth", () => {
  it("includes only trades whose entry_date falls in the current calendar month", () => {
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-15`;
    const inMonth = makeTrade({ entry_date: thisMonth });
    const outOfMonth = makeTrade({ entry_date: "2020-01-01" });
    const result = getTradesInCurrentMonth([inMonth, outOfMonth]);
    expect(result).toEqual([inMonth]);
  });
});

describe("getPnlByPeriod", () => {
  it("buckets by day using the raw entry_date as the key", () => {
    const trades = [
      makeTrade({ entry_date: "2026-03-01", pnl: 10 }),
      makeTrade({ entry_date: "2026-03-01", pnl: 20 }),
      makeTrade({ entry_date: "2026-03-02", pnl: 5 }),
    ];
    const buckets = getPnlByPeriod(trades, "day");
    expect(buckets).toHaveLength(2);
    expect(buckets.find((b) => b.key === "2026-03-01")!.pnl).toBe(30);
    expect(buckets.find((b) => b.key === "2026-03-01")!.count).toBe(2);
  });

  it("buckets by week using that week's Monday as the key", () => {
    // 2026-03-04 is a Wednesday; that week's Monday is 2026-03-02.
    const trades = [makeTrade({ entry_date: "2026-03-04", pnl: 10 })];
    const buckets = getPnlByPeriod(trades, "week");
    expect(buckets[0].key).toBe("2026-03-02");
  });

  it("buckets by month using a YYYY-MM key", () => {
    const trades = [
      makeTrade({ entry_date: "2026-03-04", pnl: 10 }),
      makeTrade({ entry_date: "2026-03-20", pnl: 5 }),
    ];
    const buckets = getPnlByPeriod(trades, "month");
    expect(buckets).toHaveLength(1);
    expect(buckets[0].key).toBe("2026-03");
    expect(buckets[0].pnl).toBe(15);
  });

  it("sorts buckets chronologically by key", () => {
    const trades = [
      makeTrade({ entry_date: "2026-03-02", pnl: 1 }),
      makeTrade({ entry_date: "2026-01-01", pnl: 1 }),
    ];
    const buckets = getPnlByPeriod(trades, "day");
    expect(buckets.map((b) => b.key)).toEqual(["2026-01-01", "2026-03-02"]);
  });
});

describe("getPerformanceByHour", () => {
  it("buckets trades into 24 hourly buckets by entry_time", () => {
    const trades = [
      makeTrade({ entry_time: "09:30", pnl: 100 }),
      makeTrade({ entry_time: "09:45", pnl: -20 }),
      makeTrade({ entry_time: "14:00", pnl: 50 }),
    ];
    const buckets = getPerformanceByHour(trades, "entry");
    expect(buckets).toHaveLength(24);
    expect(buckets[9].count).toBe(2);
    expect(buckets[9].totalPnl).toBe(80);
    expect(buckets[14].count).toBe(1);
  });

  it("buckets by exit_time when source is 'exit'", () => {
    const trades = [makeTrade({ entry_time: "09:00", exit_time: "16:00", pnl: 10 })];
    const buckets = getPerformanceByHour(trades, "exit");
    expect(buckets[16].count).toBe(1);
    expect(buckets[9].count).toBe(0);
  });

  it("excludes trades with no recorded value for the chosen time source", () => {
    const trades = [makeTrade({ entry_time: null, pnl: 10 })];
    const buckets = getPerformanceByHour(trades, "entry");
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it("excludes trades with an unparseable time string", () => {
    const trades = [makeTrade({ entry_time: "not-a-time", pnl: 10 })];
    const buckets = getPerformanceByHour(trades, "entry");
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });
});

describe("getTradesInHourBucket", () => {
  it("returns trades falling in the specified hour for the given time source", () => {
    const match = makeTrade({ entry_time: "10:15" });
    const other = makeTrade({ entry_time: "11:15" });
    const result = getTradesInHourBucket([match, other], "entry", "h10");
    expect(result).toEqual([match]);
  });

  it("returns an empty array for an unparseable bucket key", () => {
    expect(getTradesInHourBucket([makeTrade()], "entry", "bogus")).toEqual([]);
  });
});

describe("countMissingTimeOfDay", () => {
  it("counts trades with no value for the chosen time source", () => {
    const trades = [makeTrade({ entry_time: null }), makeTrade({ entry_time: "09:00" })];
    expect(countMissingTimeOfDay(trades, "entry")).toBe(1);
  });
});

describe("getPerformanceByHoldingTime", () => {
  it("buckets a trade by its holding duration from entry to exit timestamp", () => {
    const trade = makeTrade({
      entry_date: "2026-01-01",
      entry_time: "09:00:00",
      exit_date: "2026-01-01",
      exit_time: "09:10:00", // 10 minutes -> "5-15m" bucket
      pnl: 25,
    });
    const buckets = getPerformanceByHoldingTime([trade]);
    const bucket = buckets.find((b) => b.label === "5-15m")!;
    expect(bucket.count).toBe(1);
    expect(bucket.totalPnl).toBe(25);
  });

  it("excludes trades missing any of the four timestamp fields", () => {
    const trade = makeTrade({ entry_time: null, exit_date: "2026-01-01", exit_time: "10:00:00" });
    const buckets = getPerformanceByHoldingTime([trade]);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it("excludes trades where the exit is logged before the entry (negative duration)", () => {
    const trade = makeTrade({
      entry_date: "2026-01-02",
      entry_time: "09:00:00",
      exit_date: "2026-01-01",
      exit_time: "09:00:00",
    });
    const buckets = getPerformanceByHoldingTime([trade]);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it("buckets a multi-day hold into the 3d+ bucket", () => {
    const trade = makeTrade({
      entry_date: "2026-01-01",
      entry_time: "09:00:00",
      exit_date: "2026-01-05",
      exit_time: "09:00:00",
    });
    const buckets = getPerformanceByHoldingTime([trade]);
    expect(buckets.find((b) => b.label === "3d+")!.count).toBe(1);
  });
});

describe("getTradesInHoldingTimeBucket", () => {
  it("returns trades whose holding time falls in the specified bucket", () => {
    const trade = makeTrade({
      entry_date: "2026-01-01",
      entry_time: "09:00:00",
      exit_date: "2026-01-01",
      exit_time: "09:00:30", // <1m
    });
    const result = getTradesInHoldingTimeBucket([trade], "ht0");
    expect(result).toEqual([trade]);
  });

  it("returns an empty array for an unrecognized bucket key", () => {
    expect(getTradesInHoldingTimeBucket([makeTrade()], "bogus")).toEqual([]);
  });
});

describe("countMissingHoldingTime", () => {
  it("counts trades with no reliable holding-time duration", () => {
    const withDuration = makeTrade({
      entry_date: "2026-01-01",
      entry_time: "09:00:00",
      exit_date: "2026-01-01",
      exit_time: "09:10:00",
    });
    const withoutDuration = makeTrade({ entry_time: null });
    expect(countMissingHoldingTime([withDuration, withoutDuration])).toBe(1);
  });
});

describe("getTradesInMonth", () => {
  it("returns trades whose entry_date falls within the given 1-indexed month", () => {
    const match = makeTrade({ entry_date: "2026-03-15" });
    const other = makeTrade({ entry_date: "2026-04-15" });
    const result = getTradesInMonth([match, other], 2026, 3);
    expect(result).toEqual([match]);
  });
});

describe("getDailyPnlForMonth", () => {
  it("returns one entry per calendar day, summing P&L for days with trades", () => {
    const trades = [
      makeTrade({ entry_date: "2026-02-01", pnl: 10 }),
      makeTrade({ entry_date: "2026-02-01", pnl: 5 }),
    ];
    const days = getDailyPnlForMonth(trades, 2026, 2); // Feb 2026 has 28 days
    expect(days).toHaveLength(28);
    const day1 = days.find((d) => d.day === 1)!;
    expect(day1.pnl).toBe(15);
    expect(day1.count).toBe(2);
  });

  it("returns zero pnl and count for days with no trades", () => {
    const days = getDailyPnlForMonth([], 2026, 2);
    expect(days.every((d) => d.pnl === 0 && d.count === 0)).toBe(true);
  });

  it("excludes trades outside the given month", () => {
    const trades = [makeTrade({ entry_date: "2026-03-01", pnl: 999 })];
    const days = getDailyPnlForMonth(trades, 2026, 2);
    expect(days.reduce((s, d) => s + d.pnl, 0)).toBe(0);
  });
});

describe("getBestWorstDay", () => {
  it("finds the highest and lowest P&L days among days with trades", () => {
    const days = [
      { date: "2026-02-01", day: 1, pnl: 100, count: 2 },
      { date: "2026-02-02", day: 2, pnl: -50, count: 1 },
      { date: "2026-02-03", day: 3, pnl: 0, count: 0 }, // no trades, excluded
    ];
    const result = getBestWorstDay(days);
    expect(result.best?.date).toBe("2026-02-01");
    expect(result.worst?.date).toBe("2026-02-02");
  });

  it("returns null best/worst when no day has any trades", () => {
    const days = [{ date: "2026-02-01", day: 1, pnl: 0, count: 0 }];
    expect(getBestWorstDay(days)).toEqual({ best: null, worst: null });
  });
});

describe("getBestWorstTrade", () => {
  it("finds the single biggest-winning and biggest-losing trade by raw P&L", () => {
    const best = makeTrade({ pnl: 500 });
    const worst = makeTrade({ pnl: -300 });
    const middle = makeTrade({ pnl: 10 });
    const result = getBestWorstTrade([middle, best, worst]);
    expect(result.best).toBe(best);
    expect(result.worst).toBe(worst);
  });

  it("returns null best/worst for an empty trade set", () => {
    expect(getBestWorstTrade([])).toEqual({ best: null, worst: null });
  });
});

describe("getTradeRowEmphasis", () => {
  it("computes maxAbsPnl and highlights the best/worst trade when they differ", () => {
    const best = makeTrade({ pnl: 100 });
    const worst = makeTrade({ pnl: -200 });
    const result = getTradeRowEmphasis([best, worst]);
    expect(result.maxAbsPnl).toBe(200);
    expect(result.bestId).toBe(best.id);
    expect(result.worstId).toBe(worst.id);
  });

  it("highlights nothing for a single-trade set", () => {
    const trade = makeTrade({ pnl: 100 });
    const result = getTradeRowEmphasis([trade]);
    expect(result.bestId).toBeNull();
    expect(result.worstId).toBeNull();
    expect(result.maxAbsPnl).toBe(100);
  });

  it("highlights nothing when best and worst are the same trade (all tied)", () => {
    const a = makeTrade({ pnl: 50 });
    const b = makeTrade({ pnl: 50 });
    const result = getTradeRowEmphasis([a, b]);
    expect(result.bestId).toBeNull();
    expect(result.worstId).toBeNull();
  });

  it("returns zero maxAbsPnl for an empty trade set", () => {
    expect(getTradeRowEmphasis([])).toEqual({ maxAbsPnl: 0, bestId: null, worstId: null });
  });
});
