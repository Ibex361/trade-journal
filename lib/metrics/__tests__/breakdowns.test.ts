import { describe, it, expect } from "vitest";
import {
  STRATEGY_MIN_SAMPLE_SIZE,
  getStrategyLeaderboard,
  getStrategyAssetDirectionBreakdown,
  getBreakdownByDimension,
  getTradesInBreakdownGroup,
  getExitReasonByStrategy,
  getTradesInStrategyExitGroup,
  getSlHitRateByStrategy,
  getTradesInSlMovementGroup,
  getRMultipleDistribution,
  getTradesInRMultipleBucket,
  countMissingRMultiple,
  getPlannedVsRealizedR,
  countMissingPlannedR,
  summarizePlannedVsRealizedR,
  getTagFrequency,
} from "../breakdowns";
import { makeTrade } from "../../testFixtures";

describe("getStrategyLeaderboard", () => {
  it("groups trades by strategy and computes full metrics per group", () => {
    const trades = [
      makeTrade({ strategy: "Breakout", pnl: 100, r_multiple: 2 }),
      makeTrade({ strategy: "Breakout", pnl: -50, r_multiple: -1 }),
      makeTrade({ strategy: "Reversal", pnl: 30, r_multiple: 1 }),
    ];
    const rows = getStrategyLeaderboard(trades);
    expect(rows).toHaveLength(2);
    const breakout = rows.find((r) => r.key === "Breakout")!;
    expect(breakout.count).toBe(2);
    expect(breakout.totalPnl).toBe(50);
  });

  it("groups trades with no strategy under the 'unspecified' key, labeled for display", () => {
    const trades = [makeTrade({ strategy: null, pnl: 10 })];
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].key).toBe("unspecified");
    expect(rows[0].label).toBe("No strategy tagged");
  });

  it("flags a strategy as lowSample when its trade count is below the minimum sample size", () => {
    const trades = Array.from({ length: STRATEGY_MIN_SAMPLE_SIZE - 1 }, () =>
      makeTrade({ strategy: "Thin", pnl: 10 })
    );
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].lowSample).toBe(true);
  });

  it("does not flag a strategy as lowSample once it reaches the minimum sample size", () => {
    const trades = Array.from({ length: STRATEGY_MIN_SAMPLE_SIZE }, () =>
      makeTrade({ strategy: "Thick", pnl: 10 })
    );
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].lowSample).toBe(false);
  });

  it("sorts by expectancyR descending, with no-R-data strategies sorting last", () => {
    const trades = [
      makeTrade({ strategy: "Low", pnl: 10, r_multiple: 0.5 }),
      makeTrade({ strategy: "High", pnl: 10, r_multiple: 3 }),
      makeTrade({ strategy: "NoR", pnl: 10, r_multiple: null }),
    ];
    const rows = getStrategyLeaderboard(trades);
    expect(rows.map((r) => r.key)).toEqual(["High", "Low", "NoR"]);
  });

  it("computes payoffRatio from average winning R over average |losing R|", () => {
    const trades = [
      makeTrade({ strategy: "S", pnl: 100, r_multiple: 2 }),
      makeTrade({ strategy: "S", pnl: -50, r_multiple: -1 }),
    ];
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].payoffRatio).toBeCloseTo(2, 5); // avgWinR 2 / avgLossR 1
  });

  it("returns null payoffRatio when there are no losing trades to divide by", () => {
    const trades = [makeTrade({ strategy: "S", pnl: 100, r_multiple: 2 })];
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].payoffRatio).toBeNull();
  });

  it("computes stdDevR as population std deviation across trades with an r_multiple", () => {
    const trades = [
      makeTrade({ strategy: "S", pnl: 10, r_multiple: 1 }),
      makeTrade({ strategy: "S", pnl: 10, r_multiple: 3 }),
    ];
    const rows = getStrategyLeaderboard(trades);
    // mean = 2, variance = ((1-2)^2 + (3-2)^2) / 2 = 1, stdDev = 1
    expect(rows[0].stdDevR).toBeCloseTo(1, 5);
  });

  it("returns null stdDevR when fewer than two trades have an r_multiple", () => {
    const trades = [makeTrade({ strategy: "S", pnl: 10, r_multiple: 1 })];
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].stdDevR).toBeNull();
  });

  it("computes the strategy's own isolated drawdown, starting from a zero baseline", () => {
    const trades = [
      makeTrade({ strategy: "S", pnl: 100, entry_date: "2026-01-01", created_at: "2026-01-01T00:00:00.000Z" }),
      makeTrade({ strategy: "S", pnl: -40, entry_date: "2026-01-02", created_at: "2026-01-02T00:00:00.000Z" }),
    ];
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].maxDrawdownAmount).toBe(40);
    expect(rows[0].maxDrawdownPct).toBeCloseTo(40, 5); // 40/100
  });

  it("reads 0% (not null) drawdown for a strategy with a positive, never-drawn-down curve", () => {
    const trades = [makeTrade({ strategy: "S", pnl: 100 })];
    const rows = getStrategyLeaderboard(trades);
    expect(rows[0].maxDrawdownAmount).toBe(0);
    expect(rows[0].maxDrawdownPct).toBe(0);
  });
});

describe("getStrategyAssetDirectionBreakdown", () => {
  it("groups a single strategy's trades by instrument + direction", () => {
    const trades = [
      makeTrade({ strategy: "S", instrument: "EURUSD", direction: "long", pnl: 10 }),
      makeTrade({ strategy: "S", instrument: "EURUSD", direction: "short", pnl: 20 }),
      makeTrade({ strategy: "S", instrument: "GBPUSD", direction: "long", pnl: 30 }),
      makeTrade({ strategy: "Other", instrument: "EURUSD", direction: "long", pnl: 999 }),
    ];
    const rows = getStrategyAssetDirectionBreakdown(trades, "S");
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.totalPnl !== 999)).toBe(true);
  });

  it("labels direction as Long/Short/No direction and includes instrument/direction fields", () => {
    const trades = [
      makeTrade({ strategy: "S", instrument: "EURUSD", direction: "long", pnl: 10 }),
      makeTrade({ strategy: "S", instrument: "EURUSD", direction: null, pnl: 10 }),
    ];
    const rows = getStrategyAssetDirectionBreakdown(trades, "S");
    const long = rows.find((r) => r.direction === "long")!;
    const none = rows.find((r) => r.direction === null)!;
    expect(long.label).toBe("EURUSD · Long");
    expect(none.label).toBe("EURUSD · No direction");
  });

  it("sorts groups by total P&L descending", () => {
    const trades = [
      makeTrade({ strategy: "S", instrument: "A", direction: "long", pnl: 5 }),
      makeTrade({ strategy: "S", instrument: "B", direction: "long", pnl: 50 }),
    ];
    const rows = getStrategyAssetDirectionBreakdown(trades, "S");
    expect(rows.map((r) => r.instrument)).toEqual(["B", "A"]);
  });

  it("matches the 'unspecified' strategyKey against trades with no strategy set", () => {
    const trades = [makeTrade({ strategy: null, instrument: "EURUSD", direction: "long", pnl: 10 })];
    const rows = getStrategyAssetDirectionBreakdown(trades, "unspecified");
    expect(rows).toHaveLength(1);
  });
});

describe("getBreakdownByDimension", () => {
  it("groups by a plain string field (instrument)", () => {
    const trades = [
      makeTrade({ instrument: "EURUSD", pnl: 10 }),
      makeTrade({ instrument: "EURUSD", pnl: 20 }),
      makeTrade({ instrument: "GBPUSD", pnl: -5 }),
    ];
    const groups = getBreakdownByDimension(trades, "instrument");
    const eur = groups.find((g) => g.key === "EURUSD")!;
    expect(eur.count).toBe(2);
    expect(eur.totalPnl).toBe(30);
  });

  it("groups the direction dimension by trade.direction with Long/Short labels", () => {
    const trades = [
      makeTrade({ direction: "long", pnl: 10 }),
      makeTrade({ direction: "short", pnl: -10 }),
    ];
    const groups = getBreakdownByDimension(trades, "direction");
    const long = groups.find((g) => g.key === "long")!;
    const short = groups.find((g) => g.key === "short")!;
    expect(long.label).toBe("Long");
    expect(short.label).toBe("Short");
  });

  it("groups the rules_followed dimension from a boolean field into yes/no labels", () => {
    const trades = [
      makeTrade({ rules_followed: true, pnl: 10 }),
      makeTrade({ rules_followed: false, pnl: -10 }),
      makeTrade({ rules_followed: null, pnl: 0 }),
    ];
    const groups = getBreakdownByDimension(trades, "rules_followed");
    const yes = groups.find((g) => g.key === "yes")!;
    const no = groups.find((g) => g.key === "no")!;
    const unspecified = groups.find((g) => g.key === "unspecified")!;
    expect(yes.label).toBe("Rules followed");
    expect(no.label).toBe("Rules not followed");
    expect(unspecified.label).toBe("Unspecified");
  });

  it("labels a null-valued group as Unspecified for non-boolean dimensions", () => {
    const trades = [makeTrade({ asset_class: null, pnl: 10 })];
    const groups = getBreakdownByDimension(trades, "asset_class");
    expect(groups[0].key).toBe("unspecified");
    expect(groups[0].label).toBe("Unspecified");
  });

  it("sorts groups by total P&L descending", () => {
    const trades = [
      makeTrade({ session: "London", pnl: 5 }),
      makeTrade({ session: "NY", pnl: 50 }),
    ];
    const groups = getBreakdownByDimension(trades, "session");
    expect(groups.map((g) => g.key)).toEqual(["NY", "London"]);
  });
});

describe("getTradesInBreakdownGroup", () => {
  it("returns only trades matching the given dimension value", () => {
    const eurTrade = makeTrade({ instrument: "EURUSD" });
    const gbpTrade = makeTrade({ instrument: "GBPUSD" });
    const result = getTradesInBreakdownGroup([eurTrade, gbpTrade], "instrument", "EURUSD");
    expect(result).toEqual([eurTrade]);
  });

  it("matches trades with a null field value against the 'unspecified' key", () => {
    const trade = makeTrade({ asset_class: null });
    const result = getTradesInBreakdownGroup([trade], "asset_class", "unspecified");
    expect(result).toEqual([trade]);
  });
});

describe("getExitReasonByStrategy", () => {
  it("computes counts and percentages over only the trades with a recorded exit_reason", () => {
    const trades = [
      makeTrade({ strategy: "S", exit_reason: "stop_loss" }),
      makeTrade({ strategy: "S", exit_reason: "take_profit" }),
      makeTrade({ strategy: "S", exit_reason: "take_profit" }),
      makeTrade({ strategy: "S", exit_reason: null }),
    ];
    const rows = getExitReasonByStrategy(trades);
    const row = rows[0];
    expect(row.totalCount).toBe(4);
    expect(row.recordedCount).toBe(3);
    expect(row.missingCount).toBe(1);
    expect(row.counts.stop_loss).toBe(1);
    expect(row.counts.take_profit).toBe(2);
    expect(row.pcts.stop_loss).toBeCloseTo(33.333, 2);
    expect(row.pcts.take_profit).toBeCloseTo(66.667, 2);
  });

  it("drops strategies with zero recorded exit reasons entirely", () => {
    const trades = [makeTrade({ strategy: "NoData", exit_reason: null })];
    const rows = getExitReasonByStrategy(trades);
    expect(rows).toHaveLength(0);
  });

  it("sorts by recordedCount descending", () => {
    const trades = [
      makeTrade({ strategy: "Small", exit_reason: "stop_loss" }),
      makeTrade({ strategy: "Big", exit_reason: "stop_loss" }),
      makeTrade({ strategy: "Big", exit_reason: "take_profit" }),
    ];
    const rows = getExitReasonByStrategy(trades);
    expect(rows.map((r) => r.key)).toEqual(["Big", "Small"]);
  });
});

describe("getTradesInStrategyExitGroup", () => {
  it("returns trades matching both the strategy and exit reason", () => {
    const match = makeTrade({ strategy: "S", exit_reason: "stop_loss" });
    const wrongReason = makeTrade({ strategy: "S", exit_reason: "take_profit" });
    const wrongStrategy = makeTrade({ strategy: "Other", exit_reason: "stop_loss" });
    const result = getTradesInStrategyExitGroup([match, wrongReason, wrongStrategy], "S", "stop_loss");
    expect(result).toEqual([match]);
  });
});

describe("getSlHitRateByStrategy", () => {
  it("splits trades into held/tightened/widened segments and computes each hit rate independently", () => {
    const trades = [
      makeTrade({ strategy: "S", sl_movement: "held", exit_reason: "stop_loss" }),
      makeTrade({ strategy: "S", sl_movement: "held", exit_reason: "take_profit" }),
      makeTrade({ strategy: "S", sl_movement: "tightened", exit_reason: "stop_loss" }),
    ];
    const rows = getSlHitRateByStrategy(trades);
    const row = rows[0];
    expect(row.held.count).toBe(2);
    expect(row.held.hitCount).toBe(1);
    expect(row.held.hitRate).toBeCloseTo(50, 5);
    expect(row.tightened.count).toBe(1);
    expect(row.tightened.hitRate).toBe(100);
    expect(row.widened.count).toBe(0);
    expect(row.widened.hitRate).toBeNull();
  });

  it("excludes strategies where no trade has any sl_movement recorded", () => {
    const trades = [makeTrade({ strategy: "S", sl_movement: null })];
    const rows = getSlHitRateByStrategy(trades);
    expect(rows).toHaveLength(0);
  });

  it("sorts by combined segment count descending", () => {
    const trades = [
      makeTrade({ strategy: "Small", sl_movement: "held" }),
      makeTrade({ strategy: "Big", sl_movement: "held" }),
      makeTrade({ strategy: "Big", sl_movement: "tightened" }),
    ];
    const rows = getSlHitRateByStrategy(trades);
    expect(rows.map((r) => r.key)).toEqual(["Big", "Small"]);
  });
});

describe("getTradesInSlMovementGroup", () => {
  it("returns trades matching both strategy and movement", () => {
    const match = makeTrade({ strategy: "S", sl_movement: "held" });
    const other = makeTrade({ strategy: "S", sl_movement: "widened" });
    const result = getTradesInSlMovementGroup([match, other], "S", "held");
    expect(result).toEqual([match]);
  });
});

describe("getRMultipleDistribution", () => {
  it("buckets trades into fixed R-multiple ranges", () => {
    const trades = [
      makeTrade({ r_multiple: -3, pnl: -300 }), // < -2R
      makeTrade({ r_multiple: 0.5, pnl: 50 }), // 0R to 1R
      makeTrade({ r_multiple: 2.5, pnl: 250 }), // 2R to 3R
    ];
    const buckets = getRMultipleDistribution(trades);
    expect(buckets.find((b) => b.key === "r0")!.count).toBe(1); // < -2R
    expect(buckets.find((b) => b.label === "0R to 1R")!.count).toBe(1);
    expect(buckets.find((b) => b.label === "2R to 3R")!.count).toBe(1);
  });

  it("excludes trades with no recorded r_multiple", () => {
    const trades = [makeTrade({ r_multiple: null })];
    const buckets = getRMultipleDistribution(trades);
    expect(buckets.reduce((s, b) => s + b.count, 0)).toBe(0);
  });

  it("marks buckets at or below 0R as loss buckets", () => {
    const buckets = getRMultipleDistribution([]);
    const negBucket = buckets.find((b) => b.label === "-1R to 0R")!;
    const posBucket = buckets.find((b) => b.label === "0R to 1R")!;
    expect(negBucket.isLoss).toBe(true);
    expect(posBucket.isLoss).toBe(false);
  });

  it("uses a half-open [edge, nextEdge) range so a boundary value falls in the upper bucket", () => {
    const trades = [makeTrade({ r_multiple: 1 })]; // exactly on the 1R boundary
    const buckets = getRMultipleDistribution(trades);
    expect(buckets.find((b) => b.label === "1R to 2R")!.count).toBe(1);
    expect(buckets.find((b) => b.label === "0R to 1R")!.count).toBe(0);
  });
});

describe("getTradesInRMultipleBucket", () => {
  it("returns trades whose r_multiple falls in the given bucket's range", () => {
    const trades = [makeTrade({ r_multiple: 0.5 }), makeTrade({ r_multiple: 5 })];
    const result = getTradesInRMultipleBucket(trades, "r3"); // "0R to 1R"
    expect(result).toHaveLength(1);
    expect(result[0].r_multiple).toBe(0.5);
  });

  it("returns an empty array for an unrecognized bucket key", () => {
    expect(getTradesInRMultipleBucket([makeTrade()], "bogus")).toEqual([]);
  });
});

describe("countMissingRMultiple", () => {
  it("counts trades with a null or NaN r_multiple", () => {
    const trades = [makeTrade({ r_multiple: null }), makeTrade({ r_multiple: NaN }), makeTrade({ r_multiple: 1 })];
    expect(countMissingRMultiple(trades)).toBe(2);
  });
});

describe("getPlannedVsRealizedR", () => {
  it("pairs planned R (from entry/stop/take-profit) against realized R for fully-planned trades", () => {
    const trade = makeTrade({
      direction: "long",
      entry_price: 100,
      stop_loss_price: 90,
      take_profit_price: 120,
      r_multiple: 1.5,
    });
    const points = getPlannedVsRealizedR([trade]);
    expect(points).toHaveLength(1);
    expect(points[0].plannedR).toBeCloseTo(2, 5); // (120-100)/(100-90)
    expect(points[0].realizedR).toBe(1.5);
    expect(points[0].delta).toBeCloseTo(-0.5, 5);
  });

  it("excludes trades missing a take-profit price (no plan set)", () => {
    const trade = makeTrade({
      direction: "long",
      entry_price: 100,
      stop_loss_price: 90,
      take_profit_price: null,
      r_multiple: 1.5,
    });
    expect(getPlannedVsRealizedR([trade])).toHaveLength(0);
  });

  it("excludes trades with no realized r_multiple", () => {
    const trade = makeTrade({
      direction: "long",
      entry_price: 100,
      stop_loss_price: 90,
      take_profit_price: 120,
      r_multiple: null,
    });
    expect(getPlannedVsRealizedR([trade])).toHaveLength(0);
  });
});

describe("countMissingPlannedR", () => {
  it("counts trades missing either a realized R or a full plan", () => {
    const noR = makeTrade({ r_multiple: null, entry_price: 100, stop_loss_price: 90, take_profit_price: 120 });
    const noPlan = makeTrade({ r_multiple: 1, entry_price: 100, stop_loss_price: 90, take_profit_price: null });
    const complete = makeTrade({ r_multiple: 1, entry_price: 100, stop_loss_price: 90, take_profit_price: 120 });
    expect(countMissingPlannedR([noR, noPlan, complete])).toBe(2);
  });
});

describe("summarizePlannedVsRealizedR", () => {
  it("returns all-null/zero summary for an empty point set", () => {
    expect(summarizePlannedVsRealizedR([])).toEqual({
      avgPlannedR: null,
      avgRealizedR: null,
      avgDelta: null,
      metOrExceededCount: 0,
      fellShortCount: 0,
    });
  });

  it("averages planned/realized R and splits points by whether they met or fell short of plan", () => {
    const points = [
      { id: "1", label: "A", strategy: null, exitReason: null, plannedR: 2, realizedR: 2, delta: 0 },
      { id: "2", label: "B", strategy: null, exitReason: null, plannedR: 2, realizedR: 1, delta: -1 },
    ];
    const summary = summarizePlannedVsRealizedR(points);
    expect(summary.avgPlannedR).toBe(2);
    expect(summary.avgRealizedR).toBe(1.5);
    expect(summary.avgDelta).toBeCloseTo(-0.5, 5);
    expect(summary.metOrExceededCount).toBe(1); // delta 0 counts as met
    expect(summary.fellShortCount).toBe(1);
  });
});

describe("getTagFrequency", () => {
  it("counts tag occurrences and sums each tag's net P&L", () => {
    const trades = [
      makeTrade({ tags: ["breakout", "news"], pnl: 100 }),
      makeTrade({ tags: ["breakout"], pnl: -30 }),
    ];
    const counts = getTagFrequency(trades);
    const breakout = counts.find((c) => c.tag === "breakout")!;
    const news = counts.find((c) => c.tag === "news")!;
    expect(breakout.count).toBe(2);
    expect(breakout.netPnl).toBe(70);
    expect(news.count).toBe(1);
    expect(news.netPnl).toBe(100);
  });

  it("sorts by count descending, ties broken alphabetically", () => {
    const trades = [makeTrade({ tags: ["zeta", "alpha"], pnl: 0 })];
    const counts = getTagFrequency(trades);
    expect(counts.map((c) => c.tag)).toEqual(["alpha", "zeta"]);
  });

  it("returns an empty array when no trades have tags", () => {
    expect(getTagFrequency([makeTrade({ tags: [] })])).toEqual([]);
  });
});
