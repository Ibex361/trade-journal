import { NextRequest } from "next/server";
import { serveChartData } from "@/lib/chartDataR2";

export const runtime = "nodejs";

/**
 * Serves pre-computed candles from R2 (see scripts/sync-candles.ts, which
 * populates the bucket this reads from) instead of calling a live
 * market-data API. Reads via the same signed S3 client the sync script
 * writes with — the bucket doesn't need to be public — so this still has
 * to run server-side.
 *
 * The read/validate/filter logic lives in lib/chartDataR2.ts, shared with
 * the backtest chart route (app/api/backtest-chart-data/route.ts) —
 * that's the only difference between the two: which bucket they read.
 */
export async function GET(req: NextRequest) {
  return serveChartData(new URL(req.url).searchParams, {
    bucket: process.env.R2_BUCKET_NAME,
    bucketEnvName: "R2_BUCKET_NAME",
    notSyncedMessage: (instrument) =>
      `No chart data synced yet for "${instrument}" in this range. The daily sync (see .github/workflows/sync-candles.yml) may not have run for this instrument yet, or this instrument isn't recognized in Exness's public tick archive — try "Run workflow" in the Actions tab to sync it now.`,
  });
}
