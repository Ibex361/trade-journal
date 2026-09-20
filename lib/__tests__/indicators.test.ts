import { describe, it, expect } from "vitest";
import { computeEMA } from "../indicators";

function candlesFromCloses(closes: number[]): { time: number; close: number }[] {
  // time is just an increasing index here — computeEMA doesn't care about
  // the actual timeframe, only that candles are sorted ascending by time.
  return closes.map((close, i) => ({ time: i, close }));
}

describe("computeEMA", () => {
  it("returns an empty array when there are fewer candles than the period", () => {
    const candles = candlesFromCloses([10, 11, 12]);
    expect(computeEMA(candles, 5)).toEqual([]);
  });

  it("returns an empty array for a zero or negative period", () => {
    const candles = candlesFromCloses([10, 11, 12]);
    expect(computeEMA(candles, 0)).toEqual([]);
    expect(computeEMA(candles, -1)).toEqual([]);
  });

  it("seeds the first value as a plain SMA of the first `period` closes", () => {
    const candles = candlesFromCloses([10, 11, 12, 13, 14]);
    const ema = computeEMA(candles, 3);
    // SMA of [10, 11, 12] = 11
    expect(ema[0].value).toBeCloseTo(11);
  });

  it("matches hand-computed EMA values for a simple linear series", () => {
    const candles = candlesFromCloses([10, 11, 12, 13, 14]);
    const ema = computeEMA(candles, 3);
    // k = 2/4 = 0.5; seed = 11; then 13*0.5+11*0.5=12; then 14*0.5+12*0.5=13
    expect(ema.map((p) => p.value)).toEqual([11, 12, 13]);
  });

  it("matches the well-known Investopedia 10-period EMA worked example", () => {
    // Classic textbook closes/expected-EMA pair used across many EMA
    // implementations as a correctness check.
    const closes = [22.27, 22.19, 22.08, 22.17, 22.18, 22.13, 22.23, 22.43, 22.24, 22.29, 22.15, 22.39, 22.38, 22.61, 23.36];
    const candles = candlesFromCloses(closes);
    const ema = computeEMA(candles, 10);
    const expected = [22.221, 22.2081, 22.2412, 22.2664, 22.3289, 22.5164];
    expect(ema).toHaveLength(expected.length);
    ema.forEach((p, i) => expect(p.value).toBeCloseTo(expected[i], 3));
  });

  it("returns exactly one point per candle from index period-1 onward", () => {
    const candles = candlesFromCloses(Array.from({ length: 40 }, (_, i) => 100 + i));
    const ema = computeEMA(candles, 30);
    expect(ema).toHaveLength(40 - 30 + 1); // 11 points: candles[29..39]
    expect(ema[0].time).toBe(29);
    expect(ema[ema.length - 1].time).toBe(39);
  });

  it("returns exactly `period` candles worth of input consumed as a single seed value, with no output for the seed window itself", () => {
    const candles = candlesFromCloses([1, 2, 3, 4, 5]);
    const ema = computeEMA(candles, 5);
    expect(ema).toHaveLength(1); // only the seed value — no candles left after it
    expect(ema[0].time).toBe(4); // time of the last candle in the seed window
  });

  it("preserves each output point's time as the corresponding candle's own time, not a recomputed index", () => {
    const closes = [10, 11, 12, 13, 14];
    const candles = closes.map((close, i) => ({ time: 1_000_000 + i * 60, close })); // arbitrary real-looking epoch seconds
    const ema = computeEMA(candles, 3);
    expect(ema.map((p) => p.time)).toEqual([1_000_120, 1_000_180, 1_000_240]);
  });

  it("is a no-op-safe pure function: calling it twice with the same input gives the same output", () => {
    const candles = candlesFromCloses([10, 11, 12, 13, 14, 15]);
    const first = computeEMA(candles, 3);
    const second = computeEMA(candles, 3);
    expect(second).toEqual(first);
  });
});
