// lib/indicators.ts
//
// Pure chart-indicator math, kept separate from TradeChartModal.tsx so it
// can be unit tested (lib/__tests__/indicators.test.ts) without touching
// React or lightweight-charts. Mirrors the same "pure logic extracted for
// testability" pattern as scripts/candleAggregation.ts.

/** Minimal candle shape computeEMA needs — decoupled from the full OHLC candle type so this stays easy to test and reuse. */
export type EmaInputCandle = { time: number; close: number };

/** One point of a computed EMA series, in the shape lightweight-charts' LineSeries.setData() expects. */
export type EmaPoint = { time: number; value: number };

/**
 * Computes an Exponential Moving Average of `close` over `candles`,
 * assuming `candles` is sorted ascending by time and already includes
 * enough leading lookback to seed the average (see
 * lib/chartTradeWindow.ts's EMA_SEED_CANDLES / fetchStartUtcSeconds,
 * which is what TradeChartModal uses to fetch that lookback).
 *
 * Seeding: the first EMA value is a plain SMA of the first `period`
 * candles' closes (the standard, industry-common seeding method — an
 * EMA needs *some* starting value, and a plain average of the first
 * window is what most charting platforms, including TradingView, use).
 * Every candle after that follows the standard recursive EMA formula:
 *
 *   EMA[i] = close[i] * k + EMA[i-1] * (1 - k),  where k = 2 / (period + 1)
 *
 * Returns one point per candle from index `period - 1` onward — i.e.
 * the returned series is shorter than `candles` by `period - 1` points
 * at the start, exactly where a "seed window" of the input was consumed
 * to produce the first value and never appears as its own output point.
 * If `candles.length < period`, returns an empty array — not enough
 * data to seed even the first value, and returning a partial/misleading
 * EMA would be worse than showing nothing.
 */
export function computeEMA(candles: EmaInputCandle[], period: number): EmaPoint[] {
  if (period <= 0 || candles.length < period) return [];

  const k = 2 / (period + 1);
  const result: EmaPoint[] = [];

  // Seed: plain SMA of the first `period` closes.
  let sum = 0;
  for (let i = 0; i < period; i++) sum += candles[i].close;
  let prevEma = sum / period;
  result.push({ time: candles[period - 1].time, value: prevEma });

  // Recursive EMA for every candle after the seed window.
  for (let i = period; i < candles.length; i++) {
    prevEma = candles[i].close * k + prevEma * (1 - k);
    result.push({ time: candles[i].time, value: prevEma });
  }

  return result;
}
