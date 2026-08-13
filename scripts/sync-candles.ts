// scripts/sync-candles.ts
//
// Run by .github/workflows/sync-candles.yml (daily schedule + manual
// dispatch). Standalone script, NOT part of the Next.js app build — run
// directly with `tsx` (see package.json's "sync-candles" script) since
// it needs Node's fs/network APIs and a direct Postgres connection that
// have no place inside the app's own browser/server-route code.
//
// For every instrument currently logged in `trades` (across all
// accounts — chart data is market data, not account-scoped, so one
// instrument's candles serve every account that trades it):
//   1. Figure out which (instrument, month) combinations are already in
//      R2 vs still missing, and always treat the current month as
//      needing a refresh (it's still accumulating ticks).
//   2. For each month that needs fetching: download that month's tick
//      zip from Exness's public archive, trying the plain symbol first
//      and an "m"-suffixed (Standard MT4) variant second — the archive's
//      instrument naming depends on account type (an unsuffixed name
//      like XAUUSD means Pro/Raw Spread; other account types add a
//      suffix like "m"), so a hardcoded single form isn't reliable
//      across every instrument.
//   3. Parse the CSV (Timestamp, Symbol, Bid, Ask) once, bucket the BID
//      price into all 6 timeframes in one pass (ticks are the expensive
//      part to fetch/parse — deriving every timeframe from the same
//      in-memory tick array is nearly free by comparison — see
//      candleAggregation.ts), and upload one JSON candle array per
//      (instrument, timeframe, month) to R2.
//   4. Any archive file that doesn't exist yet (future month, or a
//      symbol/suffix combination Exness never published) is logged and
//      skipped — never throws and kills the whole run over one missing
//      file, per the "handle gracefully" requirement.
//
// Idempotent and safe to re-run: a month already fully synced (and not
// the current month) is skipped on the next run rather than re-fetched,
// which is what keeps this cheap to run daily.
//
// The tick-bucketing/date-math logic lives in candleAggregation.ts
// instead of inline here, specifically so it can be unit tested
// (lib/__tests__/candleAggregation.test.ts) without pulling in this
// file's env-var/S3-client/Postgres side effects.

import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { Client as PgClient } from "pg";
import { unzipSync } from "fflate";
import { TIMEFRAMES_MINUTES, Candle, monthsBetween, computeStartMonth, candleKey, aggregateTicksToAllTimeframes } from "./candleAggregation";

// ---------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------

// How far back to backfill on a from-scratch run (no R2 data yet at all
// for an instrument). Chosen to comfortably cover this journal's actual
// trade history without backfilling years of tick data nobody will ever
// chart — see computeStartMonth (candleAggregation.ts) for how this
// bounds against the earliest trade actually logged for that instrument
// instead of always backfilling the full window regardless of need.
const MAX_BACKFILL_MONTHS = 24;

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
// Step 1: which instruments does this journal actually need candles for?
// ---------------------------------------------------------------------

/**
 * All distinct instrument symbols across every account's trades, plus
 * the earliest entry_date logged for each — the latter bounds how far
 * back that instrument needs backfilling (no point fetching 2023 tick
 * data for an instrument first traded in 2026).
 */
async function fetchInstrumentsToSync(pg: PgClient): Promise<Map<string, string | Date>> {
  // node-postgres's own generic here does NOT change what's returned at
  // runtime — a Postgres `date` column always comes back as a native JS
  // Date object, string annotation notwithstanding. Typed honestly as
  // `string | Date` so computeStartMonth's own signature (which accepts
  // both, see candleAggregation.ts) isn't fighting a lying type here.
  const { rows } = await pg.query<{ instrument: string; earliest: string | Date }>(
    `select instrument, min(entry_date) as earliest
     from trades
     where instrument is not null and instrument <> ''
     group by instrument
     order by instrument`
  );
  return new Map(rows.map((r) => [r.instrument, r.earliest]));
}

// ---------------------------------------------------------------------
// Step 2: figure out which (instrument, month) pairs need (re)fetching
// ---------------------------------------------------------------------

/** Every R2 object key that already exists under candles/{instrument}/, as a Set for O(1) lookup. */
async function listExistingKeys(s3: S3Client, bucket: string, instrument: string): Promise<Set<string>> {
  const keys = new Set<string>();
  let continuationToken: string | undefined;
  do {
    const res = await s3.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: `candles/${instrument}/`,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of res.Contents ?? []) if (obj.Key) keys.add(obj.Key);
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

// ---------------------------------------------------------------------
// Step 3: download + parse one month's tick archive
// ---------------------------------------------------------------------

const ARCHIVE_BASE = "https://ticks.ex2archive.com/ticks";

/**
 * Tries the plain instrument symbol first, then an "m"-suffixed
 * (Standard MT4) variant — Exness's tick archive names instruments per
 * the account type that traded them (see this file's header comment),
 * and this app's own trades table already normalizes to the unsuffixed
 * form (contractSizeFor / exnessImport.ts strip a trailing "m"), so the
 * raw archive file is very likely to actually be under the suffixed
 * name. Returns the raw CSV text and which symbol form worked, or null
 * if neither exists for this month (logged by the caller, not an error
 * — a future/not-yet-published month is expected, not a bug).
 */
async function fetchMonthTickCsv(
  instrument: string,
  month: string
): Promise<{ csv: string; archiveSymbol: string } | null> {
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
    return { csv: new TextDecoder().decode(files[csvName]), archiveSymbol };
  }
  console.log(`  - ${instrument} ${month}: no archive file under any known symbol form yet, skipping`);
  return null;
}

/**
 * Downloads today's still-accumulating daily tick file (the archive
 * publishes the current month day-by-day until the month closes) and
 * appends it to a month's CSV text, so the current month's candles
 * include today's ticks without waiting for Exness to publish the whole
 * month. Silently a no-op (returns the month CSV unchanged) if today's
 * daily file isn't published yet — normal early in the trading day.
 */
async function appendTodayIfCurrentMonth(monthCsv: string, archiveSymbol: string, month: string): Promise<string> {
  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  if (month !== currentMonth) return monthCsv;

  const year = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const url = `${ARCHIVE_BASE}/${archiveSymbol}/${year}/${mm}/${dd}/Exness_${archiveSymbol}_${year}_${mm}_${dd}.zip`;
  const res = await fetch(url);
  if (!res.ok) return monthCsv; // today's file not published yet — expected, not an error

  const buf = new Uint8Array(await res.arrayBuffer());
  const files = unzipSync(buf);
  const csvName = Object.keys(files).find((n) => n.toLowerCase().endsWith(".csv"));
  if (!csvName) return monthCsv;
  const todayCsv = new TextDecoder().decode(files[csvName]);
  // Drop today's header row before concatenating (both files share the
  // same "Timestamp,Symbol,Bid,Ask" header).
  const todayBody = todayCsv.slice(todayCsv.indexOf("\n") + 1);
  return `${monthCsv}\n${todayBody}`;
}

// ---------------------------------------------------------------------
// Step 4: upload
// ---------------------------------------------------------------------

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

// ---------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------

async function main() {
  const bucket = requireEnv("R2_BUCKET_NAME");
  const s3 = makeS3Client();

  const pg = new PgClient({ connectionString: requireEnv("SUPABASE_DB_URL") });
  await pg.connect();

  let instruments: Map<string, string | Date>;
  try {
    instruments = await fetchInstrumentsToSync(pg);
  } finally {
    await pg.end();
  }

  console.log(`Found ${instruments.size} distinct instrument(s) across all trades.`);

  const now = new Date();
  const currentMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let totalUploaded = 0;
  let totalSkipped = 0;

  for (const [instrument, earliestEntryDate] of instruments) {
    console.log(`\n== ${instrument} ==`);
    const startMonth = computeStartMonth(earliestEntryDate, MAX_BACKFILL_MONTHS, now);
    const allMonths = monthsBetween(startMonth, currentMonth);
    const existingKeys = await listExistingKeys(s3, bucket, instrument);

    // A month is "done" only if every timeframe's file already exists
    // for it — otherwise a prior run that failed partway through would
    // be treated as complete and never retried. The current month is
    // always re-fetched regardless (still accumulating).
    const monthsNeeded = allMonths.filter((month) => {
      if (month === currentMonth) return true;
      return !Object.keys(TIMEFRAMES_MINUTES).every((tf) => existingKeys.has(candleKey(instrument, tf, month)));
    });

    if (monthsNeeded.length === 0) {
      console.log(`  Already fully synced (${allMonths.length} month(s)), nothing to do.`);
      continue;
    }

    for (const month of monthsNeeded) {
      const fetched = await fetchMonthTickCsv(instrument, month);
      if (!fetched) {
        totalSkipped++;
        continue;
      }
      const csv = await appendTodayIfCurrentMonth(fetched.csv, fetched.archiveSymbol, month);
      const byTimeframe = aggregateTicksToAllTimeframes(csv);

      for (const [tf, candles] of Object.entries(byTimeframe)) {
        if (candles.length === 0) continue;
        await uploadCandles(s3, bucket, instrument, tf, month, candles);
        totalUploaded++;
      }
      console.log(`  ✓ ${month} (via ${fetched.archiveSymbol}): ${Object.values(byTimeframe).reduce((n, c) => n + c.length, 0)} candles across ${Object.keys(byTimeframe).length} timeframes`);
    }
  }

  console.log(`\nDone. ${totalUploaded} candle file(s) uploaded, ${totalSkipped} month(s) skipped (no archive available).`);
}

main().catch((err) => {
  console.error("::error::sync-candles.ts failed:", err);
  process.exit(1);
});
