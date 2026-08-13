import { NextRequest, NextResponse } from "next/server";
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

// Timeframes TradeChartModal's picker offers. Kept as an allow-list
// (rather than passing the client's `timeframe` query param straight
// into an R2 key) so this route can't be used to probe arbitrary R2
// paths under candles/{instrument}/ — same reasoning as the old
// Twelve-Data-interval allow-list this replaced.
const ALLOWED_TIMEFRAMES = new Set(["1min", "5min", "15min", "1h", "4h", "1day"]);

type Candle = { t: number; o: number; h: number; l: number; c: number };

let s3: S3Client | null = null;
function getS3(): S3Client | null {
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
  // @aws-sdk/client-s3's GetObjectCommand Body is a Node Readable stream
  // on the Node runtime (this route sets `export const runtime = "nodejs"`
  // above specifically so this is true) — collected into one string
  // rather than piped, since a single month's candle JSON (worst case
  // ~1.2MB for 1min, see the storage-cost estimate from the migration
  // planning conversation) is small enough that buffering it whole is
  // simpler than streaming it through to the client unparsed.
  const stream = body as import("stream").Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks).toString("utf-8");
}

/**
 * Fetches one (instrument, timeframe, month) candle file from R2, or
 * null if that month doesn't exist there (yet, or ever — e.g. a month
 * before the instrument was first traded, or before this pipeline's
 * backfill window). Not an error case on its own; the caller decides
 * whether "some months missing" still leaves enough data to render.
 */
async function fetchMonthFromR2(bucket: string, instrument: string, timeframe: string, month: string): Promise<Candle[] | null> {
  const client = getS3()!;
  try {
    const res = await client.send(
      new GetObjectCommand({ Bucket: bucket, Key: `candles/${instrument}/${timeframe}/${month}.json` })
    );
    const text = await streamToString(res.Body as never);
    if (!text) return null;
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : null;
  } catch (err: unknown) {
    const code = (err as { name?: string; Code?: string })?.name ?? (err as { Code?: string })?.Code;
    if (code === "NoSuchKey" || code === "NotFound") return null; // this month hasn't been synced (or never will be) — not an error
    throw err;
  }
}

function monthsBetween(startYYYYMM: string, endYYYYMM: string): string[] {
  const months: string[] = [];
  const [sy, sm] = startYYYYMM.split("-").map(Number);
  const [ey, em] = endYYYYMM.split("-").map(Number);
  let y = sy;
  let m = sm;
  while (y < ey || (y === ey && m <= em)) {
    months.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return months;
}

function monthOf(epochSeconds: number): string {
  const d = new Date(epochSeconds * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Serves pre-computed candles from R2 (see scripts/sync-candles.ts,
 * which populates the bucket this reads from) instead of calling a live
 * market-data API. Reads via the same signed S3 client the sync script
 * writes with — the bucket doesn't need to be public — so this still
 * has to run server-side, same as the Twelve Data proxy it replaced,
 * just for credential-shape reasons rather than to hide a paid API key.
 */
export async function GET(req: NextRequest) {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!getS3() || !bucket) {
    return NextResponse.json(
      { error: "Chart data isn't configured (missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET_NAME)." },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(req.url);
  const instrument = searchParams.get("symbol"); // still called "symbol" in the query string — TradeChartModal's request shape didn't need to change
  const timeframe = searchParams.get("timeframe");
  const startParam = searchParams.get("start"); // "YYYY-MM-DD HH:mm:ss", produced by chartTradeWindow.ts's toDateParam
  const endParam = searchParams.get("end");

  if (!instrument) {
    return NextResponse.json({ error: "Missing symbol." }, { status: 400 });
  }
  if (!timeframe || !ALLOWED_TIMEFRAMES.has(timeframe)) {
    return NextResponse.json({ error: "Missing or unsupported timeframe." }, { status: 400 });
  }
  if (!startParam || !endParam) {
    return NextResponse.json({ error: "Missing start/end range." }, { status: 400 });
  }

  const startSeconds = Math.floor(new Date(`${startParam.replace(" ", "T")}Z`).getTime() / 1000);
  const endSeconds = Math.floor(new Date(`${endParam.replace(" ", "T")}Z`).getTime() / 1000);
  if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
    return NextResponse.json({ error: "Invalid start/end range." }, { status: 400 });
  }

  const months = monthsBetween(monthOf(startSeconds), monthOf(endSeconds));

  let anyMonthFound = false;
  const allCandles: Candle[] = [];
  try {
    for (const month of months) {
      const monthCandles = await fetchMonthFromR2(bucket, instrument, timeframe, month);
      if (monthCandles) {
        anyMonthFound = true;
        allCandles.push(...monthCandles);
      }
    }
  } catch {
    return NextResponse.json({ error: "Couldn't reach chart storage. Please try again." }, { status: 502 });
  }

  if (!anyMonthFound) {
    return NextResponse.json(
      {
        error: `No chart data synced yet for "${instrument}" in this range. The daily sync (see .github/workflows/sync-candles.yml) may not have run for this instrument yet, or this instrument isn't recognized in Exness's public tick archive — try "Run workflow" in the Actions tab to sync it now.`,
      },
      { status: 404 }
    );
  }

  const inRange = allCandles
    .filter((c) => c.t >= startSeconds && c.t <= endSeconds)
    .sort((a, b) => a.t - b.t)
    .map((c) => ({ time: c.t, open: c.o, high: c.h, low: c.l, close: c.c }));

  return NextResponse.json({ candles: inRange });
}
