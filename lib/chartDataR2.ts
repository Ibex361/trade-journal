// lib/chartDataR2.ts
//
// Server-side R2 candle reading shared by BOTH chart-data routes:
// app/api/chart-data/route.ts (live-trade candles, R2_BUCKET_NAME) and
// app/api/backtest-chart-data/route.ts (backtest candles,
// R2_BACKTEST_BUCKET_NAME). The two buckets use the identical key shape
// (see scripts/sync-backtest-candles.ts's header), so everything except
// "which bucket" is the same — extracted here so the two routes can't
// drift apart the way two hand-copied versions eventually would (one
// gaining a fix the other misses).
//
// Not marked "server-only": this file's only Node dependency is the AWS
// SDK, and it's only ever imported from route handlers.

import { NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { monthsBetween } from "../scripts/candleAggregation";

// Timeframes TradeChartModal's picker offers. An allow-list (rather than
// passing the client's `timeframe` straight into an R2 key) so the routes
// can't be used to probe arbitrary R2 paths.
export const ALLOWED_TIMEFRAMES = new Set(["1min", "5min", "15min", "1h", "4h", "1day"]);

// Instrument is interpolated into an R2 key; same strict allow-list as
// lib/backtestValidation.ts's INSTRUMENT_PATTERN, so a request like
// symbol=../../x can never address a different key prefix.
const INSTRUMENT_PATTERN = /^[A-Za-z0-9._-]{1,30}$/;

type StoredCandle = { t: number; o: number; h: number; l: number; c: number };
export type ChartCandle = { time: number; open: number; high: number; low: number; close: number };

let s3: S3Client | null = null;
export function getR2Client(): S3Client | null {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) return null;
  if (!s3) {
    s3 = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    });
  }
  return s3;
}

async function streamToString(body: import("stream").Readable | ReadableStream | Blob | undefined): Promise<string | null> {
  if (!body) return null;
  // Node runtime => Body is a Readable (routes set `runtime = "nodejs"`).
  // One month's candle JSON is at most ~1.2MB (1min), small enough to
  // buffer whole rather than stream through unparsed.
  const stream = body as import("stream").Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

/** One month file, or null if it doesn't exist in R2 (not an error on its own). */
async function fetchMonthFromR2(client: S3Client, bucket: string, instrument: string, timeframe: string, month: string): Promise<StoredCandle[] | null> {
  try {
    const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: `candles/${instrument}/${timeframe}/${month}.json` }));
    const text = await streamToString(res.Body as never);
    if (!text) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err: unknown) {
    const code = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;
    if (code === "NoSuchKey" || code === "NotFound") return null;
    throw err;
  }
}

function monthOf(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** "YYYY-MM-DD HH:mm:ss" (UTC, as chartTradeWindow's toDateParam produces) -> epoch seconds, or NaN. */
export function parseRangeParam(value: string): number {
  return Math.floor(new Date(`${value.replace(" ", "T")}Z`).getTime() / 1000);
}

/**
 * The whole chart-data request, parameterized by bucket + the message to
 * show when nothing is synced. Returns a ready NextResponse.
 */
export async function serveChartData(
  searchParams: URLSearchParams,
  opts: { bucket: string | undefined; bucketEnvName: string; notSyncedMessage: (instrument: string) => string }
): Promise<NextResponse> {
  const client = getR2Client();
  if (!client || !opts.bucket) {
    return NextResponse.json(
      { error: `Chart data isn't configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / ${opts.bucketEnvName}).` },
      { status: 500 }
    );
  }

  const instrument = searchParams.get("symbol"); // query param still called "symbol": TradeChartModal's request shape is shared
  const timeframe = searchParams.get("timeframe");
  const startParam = searchParams.get("start");
  const endParam = searchParams.get("end");

  if (!instrument) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }
  // A manually-entered trade can carry any instrument text (\"EUR/USD\",
  // \"Gold\"). Those never had chart data — the sync only produces keys for
  // names that exist in Exness's archive — so the old behavior was an
  // error either way (a 404 from R2). Rejecting here keeps that outcome
  // but says WHY, and guarantees an odd name can never address a
  // different R2 key prefix.
  if (!INSTRUMENT_PATTERN.test(instrument)) {
    return NextResponse.json(
      { error: `"${instrument}" isn't a chartable instrument name — chart data exists only for Exness symbols like XAUUSD or EURUSD (letters and digits, no spaces or slashes).` },
      { status: 400 }
    );
  }
  if (!timeframe || !ALLOWED_TIMEFRAMES.has(timeframe)) {
    return NextResponse.json({ error: "Missing or unsupported timeframe." }, { status: 400 });
  }
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "Missing start/end range." }, { status: 400 });
  }

  const startSeconds = parseRangeParam(startParam);
  const endSeconds = parseRangeParam(endParam);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
    return NextResponse.json({ error: "Invalid start/end range." }, { status: 400 });
  }

  const months = monthsBetween(monthOf(startSeconds), monthOf(endSeconds));

  let anyMonthFound = false;
  const all: StoredCandle[] = [];
  try {
    for (const month of months) {
      const monthCandles = await fetchMonthFromR2(client, opts.bucket, instrument, timeframe, month);
      if (monthCandles) {
        anyMonthFound = true;
        all.push(...monthCandles);
      }
    }
  } catch {
    return NextResponse.json({ error: "Couldn't reach chart storage. Please try again." }, { status: 502 });
  }

  if (!anyMonthFound) {
    return NextResponse.json({ error: opts.notSyncedMessage(instrument) }, { status: 404 });
  }

  const inRange: ChartCandle[] = all
    .filter((c) => c.t >= startSeconds && c.t <= endSeconds)
    .sort((a, b) => a.t - b.t)
    .map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));

  return NextResponse.json({ candles: inRange });
}
