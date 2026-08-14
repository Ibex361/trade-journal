// scripts/sync-candles.ts
//
// Run by .github/workflows/sync-candles.yml (daily schedule + manual
// dispatch). Standalone script, NOT part of the Next.js app build — run
// directly with `tsx` (see package.json's "sync-candles" script) since
// it needs Node's fs/network APIs and a direct Postgres connection that
// have no place inside the app's own browser/server-route code.
//
// DESIGN (day-driven, trade-scoped — replaces the old month-range
// backfill entirely):
//
//   Old design: for every instrument, fetch a whole month's tick zip
//   for every month between its earliest trade and now, re-fetching the
//   current month on every run. This downloaded far more data than any
//   chart could ever need (there's no "Monthly" chart timeframe), and
//   "append today's partial daily file" could ingest incomplete ticks
//   for a still-in-progress day.
//
//   New design: fetch only the individual UTC calendar days a real
//   logged trade actually spans (entry through exit inclusive — see
//   tradeDays.ts's tradeUtcDays), and ONLY once that day is fully
//   closed (isUtcDayClosed) — never a still-forming day's archive file,
//   with absolutely no tolerance for partial-day data (per explicit
//   instruction: a trade whose day isn't fully closed yet simply waits
//   for a future run rather than being marked synced with incomplete
//   ticks).
//
// For every instrument currently logged in `trades` (across all
// accounts — chart data is market data, not account-scoped):
//   1. Query every trade's instrument + entry/exit date+time (not just
//      earliest entry_date — a full backfill window is no longer
//      computed at all).
//   2. Per instrument, compute the full set of distinct UTC trade-days
//      via tradeUtcDays, keep only the ones that have fully closed.
//   3. Read that instrument's synced-days manifest from R2
//      (candles/{instrument}/synced-days.json) and skip any day
//      already marked synced.
//   4. For each remaining day, fetch that day's tick archive and
//      aggregate its ticks into all 6 timeframes, then MERGE the result
//      into that day's month's existing R2 candle file (read →
//      mergeCandles → re-upload) rather than overwriting, since a
//      month's file is now built up incrementally across many runs as
//      new trade-days appear in it. Exness only publishes a DAILY
//      per-day archive for the month that's still in progress
//      (.../YYYY/MM/DD/Exness_{SYMBOL}_{YYYY}_{MM}_{DD}.zip); every
//      other, already-closed month only has a MONTHLY archive
//      (.../YYYY/MM/Exness_{SYMBOL}_{YYYY}_{MM}.zip, no /DD/ segment) —
//      see isCurrentUtcMonth in tradeDays.ts. Needed days are grouped
//      by month first so a past month with several needed trade-days
//      downloads its one monthly archive exactly once rather than once
//      per day. Both URL shapes try the plain symbol then an
//      "m"-suffixed variant (same account-type ambiguity as before).
//   5. Mark the day synced in the manifest only after every timeframe's
//      merge+upload for that day has succeeded — so a run that fails
//      partway through leaves that day unmarked and it's naturally
//      retried on the next run, never silently skipped.
//   6. Any archive file that doesn't exist yet (symbol/suffix
//      combination Exness never published for that day) is logged and
//      skipped — never throws and kills the whole run over one missing
//      file, per the "handle gracefully" requirement. A skipped day is
//      NOT marked synced, so it's retried on future runs rather than
//      permanently given up on.
//
// Idempotent and safe to re-run: a day already in the manifest is
// skipped on the next run rather than re-fetched, which is what keeps
// this cheap to run daily even as more trade-days accumulate over time.
//
// The tick-bucketing/date-math/merge logic lives in candleAggregation.ts
// and tradeDays.ts instead of inline here, specifically so it can be
// unit tested without pulling in this file's env-var/S3-client/Postgres
// side effects.

import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { Client as PgClient } from "pg";
import { unzipSync } from "fflate";
import { TIMEFRAMES_MINUTES, Candle, candleKey, normalizeCsv, aggregateTicksToAllTimeframes, mergeCandles } from "./candleAggregation";
import { tradeUtcDays, isUtcDayClosed, isCurrentUtcMonth, pgDateToString } from "./tradeDays";
import { manifestKey, parseManifest, serializeManifest, daysNeedingSync } from "./candleSyncManifest";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`::error::Missing required env var ${name}. See this script's header comment / the workflow file for the full list.`);
    process.exit(1);
  }
  return v;
}

// Declared as a function (not a top-level const) so requireEnv's
// process.exit(1) only fires once main() actually runs — importing this
// module (e.g. indirectly, were a test ever to do so) never triggers it.
function makeS3Client() {
  return new S3Client({
    region: "auto",
    endpoint: `https://${requireEnv("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: requireEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: requireEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
}

// ---------------------------------------------------------------------
// Step 1: which (instrument, UTC day) pairs does this journal need candles for?
// ---------------------------------------------------------------------

type TradeDateFields = {
  instrument: string;
  entry_date: string | null;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
};

/**
 * Every logged trade's instrument + entry/exit date+time fields, across
 * all accounts. Unlike the old design, this fetches every trade's full
 * date/time fields (not just a per-instrument minimum), since the set
 * of days actually needed is now the union of every individual trade's
 * own entry→exit span, not a single earliest-to-now range.
 */
async function fetchTradeDateFields(pg: PgClient): Promise<TradeDateFields[]> {
  const { rows } = await pg.query<{ instrument: string; entry_date: string | Date | null; entry_time: string | null; exit_date: string | Date | null; exit_time: string | null }>(
    `select instrument, entry_date, entry_time, exit_date, exit_time
     from trades
     where instrument is not null and instrument <> ''`
  );
  return rows.map((r) => ({
    instrument: r.instrument,
    entry_date: pgDateToString(r.entry_date),
    entry_time: r.entry_time,
    exit_date: pgDateToString(r.exit_date),
    exit_time: r.exit_time,
  }));
}

/**
 * Groups trades by instrument and reduces each instrument's trades to
 * the full set of distinct, already-closed UTC calendar days that need
 * candle data — the union of every one of that instrument's trades'
 * own tradeUtcDays(), filtered to days that have fully closed as of
 * `now`. A trade whose day(s) haven't closed yet simply doesn't
 * contribute those days this run; it's picked up automatically once
 * they close on a future run — no partial-day tolerance anywhere in
 * this path.
 */
function computeInstrumentDays(trades: TradeDateFields[], now: Date): Map<string, Set<string>> {
  const byInstrument = new Map<string, Set<string>>();
  for (const trade of trades) {
    const days = tradeUtcDays(trade.entry_date, trade.entry_time, trade.exit_date, trade.exit_time);
    if (days.length === 0) continue; // unparseable/missing entry_date — nothing to sync for this trade
    let set = byInstrument.get(trade.instrument);
    if (!set) {
      set = new Set();
      byInstrument.set(trade.instrument, set);
    }
    for (const day of days) {
      if (isUtcDayClosed(day, now)) set.add(day);
    }
  }
  return byInstrument;
}

// ---------------------------------------------------------------------
// Step 2: fetch one closed day's tick archive
// ---------------------------------------------------------------------

const ARCHIVE_BASE = "https://ticks.ex2archive.com/ticks";

/**
 * Tries the plain instrument symbol first, then an "m"-suffixed
 * (Standard MT4) variant — Exness's tick archive names instruments per
 * the account type that traded them, and this app's own trades table
 * already normalizes to the unsuffixed form (contractSizeFor /
 * exnessImport.ts strip a trailing "m"), so the raw archive file is
 * very likely to actually be under the suffixed name. Returns the
 * normalized CSV text and which symbol form worked, or null if neither
 * exists for this day (logged by the caller, not an error — a symbol
 * Exness never published under either form is expected, not a bug).
 */
async function fetchDayTickCsv(instrument: string, day: string): Promise<{ csv: string; archiveSymbol: string } | null> {
  const [year, mm, dd] = day.split("-");
  const candidates = [instrument, `${instrument}m`];

  for (const archiveSymbol of candidates) {
    const url = `${ARCHIVE_BASE}/${archiveSymbol}/${year}/${mm}/${dd}/Exness_${archiveSymbol}_${year}_${mm}_${dd}.zip`;
    const res = await fetch(url);
    if (res.status === 404) continue; // this symbol form doesn't exist for this day — try the next
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
    return { csv: normalizeCsv(new TextDecoder().decode(files[csvName])), archiveSymbol };
  }
  console.log(`  - ${instrument} ${day}: no archive file under any known symbol form yet, skipping`);
  return null;
}

/**
 * Fetches a whole month's tick archive (used for any month that has
 * already closed — see isCurrentUtcMonth). Same plain/"m"-suffix
 * fallback and normalization as fetchDayTickCsv, just a different URL
 * shape: no /dd/ path segment and no _dd suffix on the filename, since
 * Exness keys a closed month's archive by month only.
 */
async function fetchMonthTickCsv(instrument: string, month: string): Promise<{ csv: string; archiveSymbol: string } | null> {
  const [year, mm] = month.split("-");
  const candidates = [instrument, `${instrument}m`];

  for (const archiveSymbol of candidates) {
    const url = `${ARCHIVE_BASE}/${archiveSymbol}/${year}/${mm}/Exness_${archiveSymbol}_${year}_${mm}.zip`;
    const res = await fetch(url);
    if (res.status === 404) continue; // this symbol form doesn't exist for this month — try the next
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
    return { csv: normalizeCsv(new TextDecoder().decode(files[csvName])), archiveSymbol };
  }
  console.log(`  - ${instrument} ${month}: no monthly archive file under any known symbol form yet, skipping`);
  return null;
}

// ---------------------------------------------------------------------
// Step 3: R2 read/merge/write helpers
// ---------------------------------------------------------------------

/** Reads and JSON-parses an R2 object's body as text, or returns null if it doesn't exist / can't be read. */
async function readR2Json(s3: S3Client, bucket: string, key: string): Promise<string | null> {
  try {
    const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    const body = await res.Body?.transformToString();
    return body ?? null;
  } catch {
    // A missing object throws (NoSuchKey) rather than returning null —
    // that's the expected, common case for a brand-new instrument/month
    // and not an error worth logging.
    return null;
  }
}

async function readManifest(s3: S3Client, bucket: string, instrument: string): Promise<Set<string>> {
  const raw = await readR2Json(s3, bucket, manifestKey(instrument));
  return parseManifest(raw);
}

async function writeManifest(s3: S3Client, bucket: string, instrument: string, days: Set<string>) {
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: manifestKey(instrument),
      Body: serializeManifest(days),
      ContentType: "application/json",
    })
  );
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
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: candleKey(instrument, timeframe, month),
      Body: JSON.stringify(candles),
      ContentType: "application/json",
    })
  );
}

/**
 * Merges freshly-aggregated candles (from either a single day's or a
 * whole month's tick archive) into R2 across all six timeframes for
 * one instrument/month, read→merge→upload per timeframe. `label` is
 * only used for the warning log (a day string or a month string,
 * whichever the caller is fetching). Returns true only if every
 * timeframe with candles to merge succeeded — a partial failure means
 * the caller should NOT mark anything synced, so it's retried whole on
 * the next run rather than left in a half-merged state.
 */
async function mergeTimeframesIntoR2(
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
    if (newCandles.length === 0) continue; // nothing to merge for this timeframe
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

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const s3 = makeS3Client();

  const pg = new PgClient({ connectionString: requireEnv("SUPABASE_DB_URL") });
  await pg.connect();

  let trades: TradeDateFields[];
  try {
    trades = await fetchTradeDateFields(pg);
  } finally {
    await pg.end();
  }

  const now = new Date();
  const instrumentDays = computeInstrumentDays(trades, now);

  console.log(`Found ${instrumentDays.size} distinct instrument(s) with at least one closed trade-day.`);

  let totalDaysSynced = 0;
  let totalDaysSkipped = 0;

  for (const [instrument, closedDays] of instrumentDays) {
    console.log(`\n== ${instrument} ==`);
    const manifest = await readManifest(s3, bucket, instrument);
    const daysToFetch = daysNeedingSync(manifest, [...closedDays].sort());

    if (daysToFetch.length === 0) {
      console.log(`  Already fully synced (${closedDays.size} closed trade-day(s)), nothing to do.`);
      continue;
    }

    // Exness only publishes a DAILY archive file for the still-open
    // current month; every past (closed) month only has a MONTHLY
    // archive. Split the needed days accordingly so past-month days
    // fetch the right URL shape instead of 404ing against a daily path
    // that no longer exists for that month.
    const currentMonthDays = daysToFetch.filter((day) => isCurrentUtcMonth(day.slice(0, 7), now));
    const pastMonthDays = daysToFetch.filter((day) => !isCurrentUtcMonth(day.slice(0, 7), now));

    for (const day of currentMonthDays) {
      const fetched = await fetchDayTickCsv(instrument, day);
      if (!fetched) {
        totalDaysSkipped++;
        continue; // not marked synced — retried on a future run
      }

      const month = day.slice(0, 7); // "YYYY-MM"
      const byTimeframe = aggregateTicksToAllTimeframes(fetched.csv);
      const dayFullySynced = await mergeTimeframesIntoR2(s3, bucket, instrument, day, month, byTimeframe);

      if (dayFullySynced) {
        manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest);
        totalDaysSynced++;
        console.log(`  ✓ ${day} (via ${fetched.archiveSymbol}): ${Object.values(byTimeframe).reduce((n, c) => n + c.length, 0)} candles merged across ${Object.keys(byTimeframe).length} timeframes`);
      } else {
        totalDaysSkipped++;
      }
    }

    // Group past-month days by month so a month with several needed
    // trade-days (e.g. multiple July trades) downloads that month's
    // archive exactly once, not once per day — the monthly zip already
    // contains every day's ticks, so one fetch covers every needed day
    // in it.
    const pastMonthGroups = new Map<string, string[]>();
    for (const day of pastMonthDays) {
      const month = day.slice(0, 7);
      const group = pastMonthGroups.get(month) ?? [];
      group.push(day);
      pastMonthGroups.set(month, group);
    }

    for (const [month, daysInMonth] of pastMonthGroups) {
      const fetched = await fetchMonthTickCsv(instrument, month);
      if (!fetched) {
        totalDaysSkipped += daysInMonth.length;
        continue; // not marked synced — retried on a future run
      }

      // The monthly archive contains ticks for the whole month; only
      // the specific trade-days actually needed get marked synced
      // below (a month may have plenty of days with no logged trade at
      // all — those never need to be tracked in the manifest), but the
      // candles merged into R2 come from the full month's ticks, same
      // as aggregating a single day's ticks would for that day's file.
      const byTimeframe = aggregateTicksToAllTimeframes(fetched.csv);
      const monthFullySynced = await mergeTimeframesIntoR2(s3, bucket, instrument, month, month, byTimeframe);

      if (monthFullySynced) {
        for (const day of daysInMonth) manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest);
        totalDaysSynced += daysInMonth.length;
        console.log(
          `  ✓ ${month} (via ${fetched.archiveSymbol}, covers ${daysInMonth.length} needed trade-day(s): ${daysInMonth.join(", ")}): ${Object.values(byTimeframe).reduce((n, c) => n + c.length, 0)} candles merged across ${Object.keys(byTimeframe).length} timeframes`
        );
      } else {
        totalDaysSkipped += daysInMonth.length;
      }
    }
  }

  console.log(`\nDone. ${totalDaysSynced} trade-day(s) synced, ${totalDaysSkipped} day(s) skipped (no archive available or a merge/upload error — will retry next run).`);
}

main().catch((err) => {
  console.error("::error::sync-candles.ts failed:", err);
  process.exit(1);
});
