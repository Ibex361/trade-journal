// scripts/candleSyncCore.ts
//
// R2 read/write and Exness tick-archive-fetch helpers shared by
// scripts/sync-candles.ts (live-trade candles) and
// scripts/sync-backtest-candles.ts (backtest candles) — extracted here
// specifically so both scripts share one implementation of "how do we
// talk to R2 and to Exness's archive", rather than the backtest sync
// forking a second copy that could silently drift from the live one
// (e.g. one gaining a bugfix the other doesn't). Both scripts point
// this SAME code at their own bucket via the `bucket` parameter every
// function here takes — nothing in this file is bucket-specific.
//
// Everything in this file is the exact logic sync-candles.ts had
// inline before this extraction; behavior is unchanged, only the
// location moved.

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { unzipSync } from "fflate";
import { TIMEFRAMES_MINUTES, Candle, candleKey, normalizeCsv, aggregateTicksToAllTimeframes, aggregateTicksFromBytes, mergeCandles } from "./candleAggregation";
import { parseManifest, serializeManifest } from "./candleSyncManifest";

const ARCHIVE_BASE = "https://ticks.ex2archive.com/ticks";

const ANSI_YELLOW = "\x1b[33m";
const ANSI_RESET = "\x1b[0m";

/**
 * Tries the plain instrument symbol first, then an "m"-suffixed
 * (Standard MT4) variant — Exness's tick archive names instruments per
 * the account type that traded them. Returns every timeframe's
 * aggregated candles and which symbol form worked, or null if neither
 * exists for this day. `isWeekend` is injected (rather than imported
 * directly from tradeDays.ts) purely to keep this module's own
 * dependency surface to "R2 + Exness fetching" — the caller already has
 * it in scope either way.
 */
export async function fetchDayTickCsv(
  instrument: string,
  day: string,
  isWeekend: (day: string) => boolean
): Promise<{ byTimeframe: Record<string, Candle[]>; archiveSymbol: string } | null> {
  const [year, mm, dd] = day.split("-");
  const candidates = [instrument, `${instrument}m`];

  for (const archiveSymbol of candidates) {
    const url = `${ARCHIVE_BASE}/${archiveSymbol}/${year}/${mm}/${dd}/Exness_${archiveSymbol}_${year}_${mm}_${dd}.zip`;
    const res = await fetch(url);
    if (res.status === 404) continue;
    if (!res.ok) {
      console.warn(`  ! ${archiveSymbol} ${day}: unexpected HTTP ${res.status} fetching ${url}, skipping this day`);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(buf);
    const csvName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
    if (!csvName) {
      console.warn(`  ! ${archiveSymbol} ${day}: zip had no CSV inside, skipping`);
      return null;
    }
    const byTimeframe = aggregateTicksToAllTimeframes(normalizeCsv(new TextDecoder().decode(files[csvName])));
    return { byTimeframe, archiveSymbol };
  }
  const weekendHint = isWeekend(day) ? ` ${ANSI_YELLOW}(This day is a weekend, maybe that's the culprit)${ANSI_RESET}` : "";
  console.log(`  - ${instrument} ${day}: no archive file under any known symbol form yet, skipping${weekendHint}`);
  return null;
}

/**
 * Fetches a whole month's tick archive (used for any month that has
 * already closed — see isCurrentUtcMonth). Same plain/"m"-suffix
 * fallback as fetchDayTickCsv, just a different URL shape. Aggregates
 * directly from the raw bytes (aggregateTicksFromBytes) rather than
 * decoding a full string — monthly archives for liquid instruments can
 * exceed V8's string-length cap.
 */
export async function fetchMonthTickCsv(instrument: string, month: string): Promise<{ candles: Record<string, Candle[]>; archiveSymbol: string } | null> {
  const [year, mm] = month.split("-");
  const candidates = [instrument, `${instrument}m`];

  for (const archiveSymbol of candidates) {
    const url = `${ARCHIVE_BASE}/${archiveSymbol}/${year}/${mm}/Exness_${archiveSymbol}_${year}_${mm}.zip`;
    const res = await fetch(url);
    if (res.status === 404) continue;
    if (!res.ok) {
      console.warn(`  ! ${archiveSymbol} ${month}: unexpected HTTP ${res.status} fetching ${url}, skipping this month`);
      return null;
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const files = unzipSync(buf);
    const csvName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
    if (!csvName) {
      console.warn(`  ! ${archiveSymbol} ${month}: zip had no CSV inside, skipping`);
      return null;
    }
    return { candles: aggregateTicksFromBytes(files[csvName]), archiveSymbol };
  }
  console.log(`  - ${instrument} ${month}: no monthly archive file under any known symbol form yet, skipping`);
  return null;
}

/** Reads and JSON-parses an R2 object's body as text, or returns null if it doesn't exist / can't be read. */
async function readR2Json(s3: S3Client, bucket: string, key: string): Promise<string | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await res.Body?.transformToString();
    return body ?? null;
  } catch {
    return null;
  }
}

export async function readManifest(s3: S3Client, bucket: string, instrument: string, manifestKeyFn: (instrument: string) => string): Promise<Set<string>> {
  const raw = await readR2Json(s3, bucket, manifestKeyFn(instrument));
  return parseManifest(raw);
}

export async function writeManifest(s3: S3Client, bucket: string, instrument: string, days: Set<string>, manifestKeyFn: (instrument: string) => string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: manifestKeyFn(instrument), Body: serializeManifest(days), ContentType: "application/json" }));
}

export async function readMonthManifest(s3: S3Client, bucket: string, instrument: string, monthManifestKeyFn: (instrument: string) => string): Promise<Set<string>> {
  const raw = await readR2Json(s3, bucket, monthManifestKeyFn(instrument));
  return parseManifest(raw);
}

export async function writeMonthManifest(s3: S3Client, bucket: string, instrument: string, months: Set<string>, monthManifestKeyFn: (instrument: string) => string) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: monthManifestKeyFn(instrument), Body: serializeManifest(months), ContentType: "application/json" }));
}

async function readExistingCandles(s3: S3Client, bucket: string, instrument: string, timeframe: string, month: string): Promise<Candle[]> {
  const raw = await readR2Json(s3, bucket, candleKey(instrument, timeframe, month));
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Candle[]) : [];
  } catch {
    return [];
  }
}

async function uploadCandles(s3: S3Client, bucket: string, instrument: string, timeframe: string, month: string, candles: Candle[]) {
  await s3.send(new PutObjectCommand({ Bucket: bucket, Key: candleKey(instrument, timeframe, month), Body: JSON.stringify(candles), ContentType: "application/json" }));
}

/**
 * Merges freshly-aggregated candles into R2 across ALL timeframes,
 * read→merge→upload per timeframe. Both callers (sync-candles.ts and
 * sync-backtest-candles.ts) always persist every timeframe — the
 * synced-days/synced-months manifests track days and months, not
 * timeframes, so persisting only a subset would let a later run that
 * needs a different timeframe wrongly skip a day the manifest calls
 * "done" (see sync-backtest-candles.ts's header for the full
 * explanation). Returns true only if every timeframe that had candles
 * was merged and uploaded successfully.
 */
export async function mergeTimeframesIntoR2(
  s3: S3Client,
  bucket: string,
  instrument: string,
  label: string,
  month: string,
  byTimeframe: Record<string, Candle[]>
): Promise<boolean> {
  let fullySynced = true;
  for (const tf of Object.keys(TIMEFRAMES_MINUTES)) {
    const newCandles = byTimeframe[tf] ?? [];
    if (newCandles.length === 0) continue;
    try {
      const existing = await readExistingCandles(s3, bucket, instrument, tf, month);
      const merged = mergeCandles(existing, newCandles);
      await uploadCandles(s3, bucket, instrument, tf, month, merged);
    } catch (err) {
      console.warn(`  ! ${instrument} ${label} ${tf}: merge/upload failed, will be retried next run:`, err);
      fullySynced = false;
    }
  }
  return fullySynced;
}
