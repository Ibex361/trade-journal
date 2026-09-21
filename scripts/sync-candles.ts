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
//   New design: fetch only the UTC calendar days a real logged trade
//   actually needs — its entry-through-exit span, PLUS a 30-day buffer
//   on each side (see tradeDays.ts's tradeUtcDaysWithContext) so the
//   1day chart has real candles around the trade instead of a gap —
//   and ONLY once a day is fully closed (isUtcDayClosed) — never a
//   still-forming day's archive file, with absolutely no tolerance for
//   partial-day data (per explicit instruction: a trade whose day isn't
//   fully closed yet simply waits for a future run rather than being
//   marked synced with incomplete ticks).
//
// For every instrument currently logged in `trades` (across all
// accounts — chart data is market data, not account-scoped):
//   1. Query every trade's instrument + entry/exit date+time (not just
//      earliest entry_date — a full backfill window is no longer
//      computed at all).
//   2. Per instrument, compute the full set of distinct UTC trade-days
//      via tradeUtcDaysWithContext, keep only the ones that have fully
//      closed.
//   3. Read that instrument's synced-days manifest from R2
//      (candles/{instrument}/synced-days.json) and skip any day
//      already marked synced. Also read its synced-months manifest
//      (candles/{instrument}/synced-months.json) — see step 4b.
//   4. For each remaining day:
//      a. Current UTC month: fetch that day's tick archive directly
//         and aggregate into all 6 timeframes.
//      b. Past (closed) month: Exness has no per-day files for a
//         closed month, only one MONTHLY archive
//         (.../YYYY/MM/Exness_{SYMBOL}_{YYYY}_{MM}.zip, no /DD/
//         segment — see isCurrentUtcMonth in tradeDays.ts) — so needed
//         days are grouped by month first. If that month is already in
//         the synced-months manifest, its whole archive was fetched on
//         a prior run and every day's candles are already in R2 — the
//         new day(s) are marked synced in the day manifest with NO
//         re-fetch. Otherwise the month's one archive is downloaded
//         once (covering every needed day in it, not once per day) and
//         aggregated; both symbol forms ("m"-suffix fallback) are tried
//         the same way the daily path does.
//   5. MERGE aggregated candles into the relevant month's existing R2
//      candle file (read → mergeCandles → re-upload) rather than
//      overwriting, since a month's file is built up incrementally
//      across many runs as new trade-days appear in it.
//   6. Mark synced only after every timeframe's merge+upload has
//      succeeded — a day for the daily path, every needed day in the
//      group AND the month itself for the monthly path (the month
//      manifest write is what lets step 4b short-circuit on a later
//      run) — so a run that fails partway leaves things unmarked and
//      they're naturally retried next run, never silently skipped.
//   7. Any archive file that doesn't exist yet (symbol/suffix
//      combination Exness never published for that day/month) is
//      logged and skipped — never throws and kills the whole run over
//      one missing file, per the "handle gracefully" requirement. A
//      skipped day/month is NOT marked synced, so it's retried on
//      future runs rather than permanently given up on.
//
// Idempotent and safe to re-run: a day already in the manifest is
// skipped on the next run rather than re-fetched, which is what keeps
// this cheap to run daily even as more trade-days accumulate over time.
//
// The tick-bucketing/date-math/merge logic lives in candleAggregation.ts
// and tradeDays.ts instead of inline here, specifically so it can be
// unit tested without pulling in this file's env-var/S3-client/Postgres
// side effects.

import { Client as PgClient } from "pg";
import { S3Client } from "@aws-sdk/client-s3";
import { tradeUtcDaysWithContext, isUtcDayClosed, isCurrentUtcMonth, isUtcWeekend, pgDateToString } from "./tradeDays";
import { manifestKey, monthManifestKey, daysNeedingSync } from "./candleSyncManifest";
import { readManifest, writeManifest, readMonthManifest, writeMonthManifest, mergeTimeframesIntoR2, fetchDayTickCsv, fetchMonthTickCsv } from "./candleSyncCore";

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
 * own tradeUtcDaysWithContext() (the trade's entry→exit span PLUS a
 * 30-day buffer on each side, so the 1day chart has real candles around
 * the trade instead of a gap — see CHART_CONTEXT_BUFFER_DAYS in
 * tradeDays.ts), filtered to days that have fully closed as of `now`. A
 * trade whose day(s) haven't closed yet simply doesn't contribute those
 * days this run; it's picked up automatically once they close on a
 * future run — no partial-day tolerance anywhere in this path.
 */
function computeInstrumentDays(trades: TradeDateFields[], now: Date): Map<string, Set<string>> {
  const byInstrument = new Map<string, Set<string>>();
  for (const trade of trades) {
    const days = tradeUtcDaysWithContext(trade.entry_date, trade.entry_time, trade.exit_date, trade.exit_time);
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
    const manifest = await readManifest(s3, bucket, instrument, manifestKey);
    const monthManifest = await readMonthManifest(s3, bucket, instrument, monthManifestKey);
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
      const fetched = await fetchDayTickCsv(instrument, day, isUtcWeekend);
      if (!fetched) {
        totalDaysSkipped++;
        continue; // not marked synced — retried on a future run
      }

      const month = day.slice(0, 7); // "YYYY-MM"
      const byTimeframe = fetched.byTimeframe;
      const dayFullySynced = await mergeTimeframesIntoR2(s3, bucket, instrument, day, month, byTimeframe);

      if (dayFullySynced) {
        manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest, manifestKey);
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
      // A month already in the month manifest means its whole archive
      // was fetched and fully merged into R2 on a prior run — every
      // day's candles for that month are already there. A NEW
      // trade-day landing in that same month (the scenario this
      // manifest exists for) needs no re-fetch at all: just record the
      // day(s) as synced so future runs don't keep re-checking them,
      // with zero network/aggregation cost.
      if (monthManifest.has(month)) {
        for (const day of daysInMonth) manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest, manifestKey);
        totalDaysSynced += daysInMonth.length;
        console.log(`  ✓ ${month} already fully synced — marking ${daysInMonth.length} new trade-day(s) synced with no re-fetch: ${daysInMonth.join(", ")}`);
        continue;
      }

      const fetched = await fetchMonthTickCsv(instrument, month);
      if (!fetched) {
        totalDaysSkipped += daysInMonth.length;
        continue; // not marked synced — retried on a future run
      }

      // The monthly archive contains ticks for the whole month; only
      // the specific trade-days actually needed get marked synced in
      // the day manifest below (a month may have plenty of days with
      // no logged trade at all — those never need day-level tracking),
      // but the candles merged into R2 come from the full month's
      // ticks, same as aggregating a single day's ticks would for that
      // day's file. Once the merge succeeds, the whole month is marked
      // done in monthManifest too — that's what lets a later trade on
      // a different day in this same month skip straight to the branch
      // above instead of re-fetching.
      const byTimeframe = fetched.candles;
      const monthFullySynced = await mergeTimeframesIntoR2(s3, bucket, instrument, month, month, byTimeframe);

      if (monthFullySynced) {
        for (const day of daysInMonth) manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest, manifestKey);
        monthManifest.add(month);
        await writeMonthManifest(s3, bucket, instrument, monthManifest, monthManifestKey);
        totalDaysSynced += daysInMonth.length;
        console.log(
          `  ✓ ${month} (via ${fetched.archiveSymbol}, covers ${daysInMonth.length} needed trade-day(s): ${daysInMonth.join(", ")}): ${Object.values(byTimeframe).reduce((n, c) => n + c.length, 0)} candles merged across ${Object.keys(byTimeframe).length} timeframes — month marked fully synced`
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
