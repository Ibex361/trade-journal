import { NextRequest } from "next/server";
import { serveChartData } from "@/lib/chartDataR2";

export const runtime = "nodejs";

/**
 * Candles for a BACKTEST trade's chart, read from the dedicated backtest
 * bucket (R2_BACKTEST_BUCKET_NAME = "exness-backtest-candles") — the very
 * same files scripts/backtest/run_backtest.py feeds to Backtrader, so the
 * chart shows exactly the data the strategy traded on, and this app never
 * downloads a tick archive for a backtest trade's chart (the live
 * sync-candles workflow is not involved at all).
 *
 * Identical request/response contract to /api/chart-data, so
 * TradeChartModal works against either by changing only the URL it
 * fetches. All the logic lives in lib/chartDataR2.ts, shared with the
 * live route.
 */
export async function GET(req: NextRequest) {
  return serveChartData(new URL(req.url).searchParams, {
    bucket: process.env.R2_BACKTEST_BUCKET_NAME,
    bucketEnvName: "R2_BACKTEST_BUCKET_NAME",
    notSyncedMessage: (instrument) =>
      `No backtest candle data found for "${instrument}" in this range. Backtest candles are downloaded when a backtest that uses this instrument runs — has one completed?`,
  });
}
