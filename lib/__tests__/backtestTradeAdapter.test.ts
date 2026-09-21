import { describe, it, expect, vi } from "vitest";

// lib/backtests.ts imports the browser Supabase client at module load; stub it
// so the pure adapter can be tested with no env vars or network.
vi.mock("../supabaseClient", () => ({ supabase: {} }));

import { backtestTradeToTrade, type BacktestTrade } from "../backtests";
import { computeTradeChartWindow, tradeLocalToUtcSeconds } from "../chartTradeWindow";

const bt: BacktestTrade = {
  id: "t1",
  run_id: "r1",
  instrument: "EURUSD",
  direction: "short",
  entry_date: "2026-01-05",
  entry_time: "13:15:00", // stored UTC+3, i.e. 10:15 UTC
  exit_date: "2026-01-05",
  exit_time: "15:45:00",
  entry_price: 1.1,
  exit_price: 1.09,
  size: 1000,
  pnl: 10,
};

describe("backtestTradeToTrade", () => {
  it("carries over every field the chart reads, unchanged", () => {
    const t = backtestTradeToTrade(bt);
    expect(t).toMatchObject({
      id: "t1",
      instrument: "EURUSD",
      direction: "short",
      entry_date: "2026-01-05",
      entry_time: "13:15:00",
      exit_date: "2026-01-05",
      exit_time: "15:45:00",
      entry_price: 1.1,
      exit_price: 1.09,
      size: 1000,
      pnl: 10,
    });
  });

  it("does not invent trade metadata a backtest doesn't have", () => {
    const t = backtestTradeToTrade(bt);
    for (const k of ["strategy", "session", "emotion", "stop_loss_price", "take_profit_price", "r_multiple", "rules_followed", "exit_reason", "notes", "screenshot_url"] as const) {
      expect(t[k]).toBeNull();
    }
    expect(t.tags).toEqual([]);
  });

  it("preserves an open/incomplete trade's nulls (no exit) rather than coercing", () => {
    const t = backtestTradeToTrade({ ...bt, exit_date: null, exit_time: null, exit_price: null, direction: null });
    expect(t.exit_date).toBeNull();
    expect(t.exit_price).toBeNull();
    expect(t.direction).toBeNull();
  });

  it("the adapted trade produces a real chart window at the right UTC instant (end-to-end with the modal's own helper)", () => {
    const t = backtestTradeToTrade(bt);
    // 13:15 local (UTC+3) must come back out as 10:15 UTC.
    expect(tradeLocalToUtcSeconds(t.entry_date, t.entry_time)).toBe(Date.UTC(2026, 0, 5, 10, 15, 0) / 1000);
    const w = computeTradeChartWindow(t, "15min");
    expect(w).not.toBeNull();
    expect(w!.isFuture).toBe(false);
  });
});
