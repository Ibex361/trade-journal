import { describe, it, expect } from "vitest";
import {
  calculatePnl,
  calculateRMultiple,
  calculatePlannedRMultiple,
  summarizeTrades,
  pickWinRate,
  getProfitFactor,
  getExpectancy,
  getTotalReturnPct,
  getAvgRiskPct,
} from "../pnl";
import { makeTrade } from "../../testFixtures";

describe("calculatePnl", () => {
  it("computes a long trade's P&L as (exit - entry) * size", () => {
    expect(calculatePnl("long", 100, 110, 10)).toBe(100);
  });

  it("computes a short trade's P&L as (entry - exit) * size", () => {
    expect(calculatePnl("short", 100, 90, 10)).toBe(100);
  });

  it("returns a negative P&L for a losing long trade", () => {
    expect(calculatePnl("long", 100, 90, 10)).toBe(-100);
  });

  it("returns a negative P&L for a losing short trade", () => {
    expect(calculatePnl("short", 100, 110, 10)).toBe(-100);
  });

  it("returns null when any required input is missing", () => {
    expect(calculatePnl("long", null, 110, 10)).toBeNull();
    expect(calculatePnl("long", 100, null, 10)).toBeNull();
    expect(calculatePnl("long", 100, 110, null)).toBeNull();
  });

  it("returns null when an input is NaN", () => {
    expect(calculatePnl("long", NaN, 110, 10)).toBeNull();
  });
});

describe("calculateRMultiple", () => {
  it("computes R as reward/risk for a long trade", () => {
    // risk = |100 - 90| = 10, reward = 120 - 100 = 20 -> R = 2
    expect(calculateRMultiple("long", 100, 120, 90)).toBe(2);
  });

  it("computes R as reward/risk for a short trade", () => {
    // risk = |100 - 110| = 10, reward = 100 - 80 = 20 -> R = 2
    expect(calculateRMultiple("short", 100, 80, 110)).toBe(2);
  });

  it("returns a negative R for a losing trade", () => {
    // risk = 10, reward = 95 - 100 = -5 -> R = -0.5
    expect(calculateRMultiple("long", 100, 95, 90)).toBe(-0.5);
  });

  it("returns null when risk is zero (entry === stop)", () => {
    expect(calculateRMultiple("long", 100, 120, 100)).toBeNull();
  });

  it("returns null when any required input is missing", () => {
    expect(calculateRMultiple("long", null, 120, 90)).toBeNull();
    expect(calculateRMultiple("long", 100, null, 90)).toBeNull();
    expect(calculateRMultiple("long", 100, 120, null)).toBeNull();
  });
});

describe("calculatePlannedRMultiple", () => {
  it("computes planned R using the take-profit as the reward target", () => {
    // risk = 10, planned reward = 130 - 100 = 30 -> planned R = 3
    expect(calculatePlannedRMultiple("long", 100, 90, 130)).toBe(3);
  });

  it("returns null when risk is zero", () => {
    expect(calculatePlannedRMultiple("long", 100, 100, 130)).toBeNull();
  });

  it("returns null when any required input is missing", () => {
    expect(calculatePlannedRMultiple("long", null, 90, 130)).toBeNull();
  });
});

describe("summarizeTrades", () => {
  it("returns all-null/zero shape for an empty trade list", () => {
    const summary = summarizeTrades([]);
    expect(summary).toEqual({
      count: 0,
      totalPnl: 0,
      winRateStrict: null,
      winRateDecided: null,
      avgR: null,
      wins: 0,
      losses: 0,
      breakeven: 0,
    });
  });

  it("counts wins, losses, and breakeven trades correctly", () => {
    const trades = [
      makeTrade({ pnl: 100 }),
      makeTrade({ pnl: -50 }),
      makeTrade({ pnl: 0 }),
      makeTrade({ pnl: 200 }),
    ];
    const summary = summarizeTrades(trades);
    expect(summary.count).toBe(4);
    expect(summary.wins).toBe(2);
    expect(summary.losses).toBe(1);
    expect(summary.breakeven).toBe(1);
    expect(summary.totalPnl).toBe(250);
  });

  it("computes winRateStrict as wins / ALL trades (breakeven counts against you)", () => {
    // 1 win, 1 breakeven -> strict = 1/2 = 50%
    const trades = [makeTrade({ pnl: 100 }), makeTrade({ pnl: 0 })];
    expect(summarizeTrades(trades).winRateStrict).toBe(50);
  });

  it("computes winRateDecided as wins / (wins + losses), excluding breakeven", () => {
    // 1 win, 1 loss, 1 breakeven -> decided = 1/2 = 50%, ignoring the breakeven
    const trades = [makeTrade({ pnl: 100 }), makeTrade({ pnl: -50 }), makeTrade({ pnl: 0 })];
    expect(summarizeTrades(trades).winRateDecided).toBe(50);
  });

  it("returns null winRateDecided when every trade is breakeven", () => {
    const trades = [makeTrade({ pnl: 0 }), makeTrade({ pnl: 0 })];
    expect(summarizeTrades(trades).winRateDecided).toBeNull();
  });

  it("averages r_multiple only across trades that have one recorded", () => {
    const trades = [
      makeTrade({ pnl: 100, r_multiple: 2 }),
      makeTrade({ pnl: -50, r_multiple: -1 }),
      makeTrade({ pnl: 30, r_multiple: null }), // no R recorded — excluded from avgR
    ];
    expect(summarizeTrades(trades).avgR).toBe(0.5);
  });

  it("returns null avgR when no trade has an r_multiple", () => {
    const trades = [makeTrade({ pnl: 10, r_multiple: null })];
    expect(summarizeTrades(trades).avgR).toBeNull();
  });
});

describe("pickWinRate", () => {
  const summary = { winRateStrict: 40, winRateDecided: 60 };
  it("returns winRateStrict for strict mode", () => {
    expect(pickWinRate(summary, "strict")).toBe(40);
  });
  it("returns winRateDecided for decided mode", () => {
    expect(pickWinRate(summary, "decided")).toBe(60);
  });
});

describe("getProfitFactor", () => {
  it("computes gross profit / gross loss", () => {
    const trades = [makeTrade({ pnl: 300 }), makeTrade({ pnl: -100 }), makeTrade({ pnl: -50 })];
    // grossProfit = 300, grossLoss = 150 -> 2
    expect(getProfitFactor(trades)).toBe(2);
  });

  it("returns null when there are no losing trades to divide by", () => {
    const trades = [makeTrade({ pnl: 100 }), makeTrade({ pnl: 0 })];
    expect(getProfitFactor(trades)).toBeNull();
  });

  it("returns null for an empty trade list", () => {
    expect(getProfitFactor([])).toBeNull();
  });
});

describe("getExpectancy", () => {
  it("returns null/null for an empty trade list", () => {
    expect(getExpectancy([])).toEqual({ perTrade: null, perR: null });
  });

  it("computes average P&L and average R per trade", () => {
    const trades = [
      makeTrade({ pnl: 100, r_multiple: 2 }),
      makeTrade({ pnl: -50, r_multiple: -1 }),
    ];
    expect(getExpectancy(trades)).toEqual({ perTrade: 25, perR: 0.5 });
  });

  it("computes perR only across trades that have an r_multiple, even if perTrade covers all", () => {
    const trades = [
      makeTrade({ pnl: 100, r_multiple: 2 }),
      makeTrade({ pnl: 100, r_multiple: null }),
    ];
    const result = getExpectancy(trades);
    expect(result.perTrade).toBe(100); // (100 + 100) / 2
    expect(result.perR).toBe(2); // only the one trade with r_multiple
  });
});

describe("getTotalReturnPct", () => {
  it("computes total P&L as a percentage of baseBalance", () => {
    const trades = [makeTrade({ pnl: 100 }), makeTrade({ pnl: -50 })];
    // totalPnl = 50, baseBalance = 1000 -> 5%
    expect(getTotalReturnPct(trades, 1000)).toBe(5);
  });

  it("returns null when baseBalance is zero", () => {
    expect(getTotalReturnPct([makeTrade({ pnl: 100 })], 0)).toBeNull();
  });

  it("returns null when baseBalance is negative", () => {
    expect(getTotalReturnPct([makeTrade({ pnl: 100 })], -1000)).toBeNull();
  });
});

describe("getAvgRiskPct", () => {
  it("averages risk % across trades using their balance-before-trade", () => {
    const t1 = makeTrade({ entry_price: 100, stop_loss_price: 90, size: 1 });
    const t2 = makeTrade({ entry_price: 200, stop_loss_price: 180, size: 1 });
    const balances = new Map([
      [t1.id, 1000], // risk = |100-90|*1 = 10 -> 1%
      [t2.id, 1000], // risk = |200-180|*1 = 20 -> 2%
    ]);
    expect(getAvgRiskPct([t1, t2], balances)).toBe(1.5);
  });

  it("skips trades missing entry_price, stop_loss_price, or size", () => {
    const t1 = makeTrade({ entry_price: 100, stop_loss_price: 90, size: 1 });
    const t2 = makeTrade({ entry_price: null, stop_loss_price: 90, size: 1 });
    const balances = new Map([
      [t1.id, 1000],
      [t2.id, 1000],
    ]);
    // Only t1 counts -> 1%, not averaged with a skipped t2
    expect(getAvgRiskPct([t1, t2], balances)).toBe(1);
  });

  it("skips trades with no balance-before entry, or a non-positive one", () => {
    const t1 = makeTrade({ entry_price: 100, stop_loss_price: 90, size: 1 });
    const balances = new Map<string, number>(); // no entry for t1.id at all
    expect(getAvgRiskPct([t1], balances)).toBeNull();
  });

  it("returns null when there are no eligible trades", () => {
    expect(getAvgRiskPct([], new Map())).toBeNull();
  });
});
