// scripts/sync-backtest-candles.ts
//
// Run by .github/workflows/backtest.yml, ONE step before the Backtrader
// run itself for that same backtest, and also runnable standalone (see
// package.json's "sync-backtest-candles" script) for manual backfills.
// This is the backtest-bucket analogue of scripts/sync-candles.ts — same
// day-driven, manifest-deduplicated design, deliberately reusing that
// script's exact pure logic (candleAggregation.ts, tradeDays.ts,
// candleSyncManifest.ts) rather than forking it, so both pipelines stay
// identical in every way that isn't specific to "which days are needed":
//
//   - Same R2 key shape (candles/{instrument}/{timeframe}/{month}.json,
//     candles/{instrument}/synced-days.json, .../synced-months.json) —
//     just written into a SEPARATE bucket (R2_BACKTEST_BUCKET_NAME,
//     "exness-backtest-candles"), not a prefix inside the live bucket.
//     A dedicated bucket is what makes "how much storage do backtest
//     candles use" a single, free R2 dashboard number instead of
//     something the app has to compute itself, and what makes wiping
//     the whole backtest candle cache a single "empty this bucket"
//     action with zero risk of touching live-trade data.
//   - Same fetchDayTickCsv/fetchMonthTickCsv, same
//     isCurrentUtcMonth/isUtcDayClosed/isUtcWeekend gating, same
//     mergeTimeframesIntoR2 read-merge-write pattern.
//
// WHAT'S DIFFERENT FROM sync-candles.ts:
//   - "Which days are needed" comes from backtest_run_feeds +
//     backtest_runs.start_date/end_date (via backtestUtcDays.ts), not
//     from a logged trade's own entry/exit span — a backtest run
//     declares its instruments/timeframes and date range explicitly up
//     front (see the New Backtest form), so there's no "trade span plus
//     a buffer" concept here, just the plain requested range clipped to
//     already-closed days.
//   - candles/{instrument}/{timeframe}/{month}.json is keyed by
//     INSTRUMENT ONLY, never by run id — this is what guarantees "no
//     re-download even for overlapping ranges" across different runs:
//     a second run touching the same instrument+month reuses whatever a
//     prior run (or this same run, on a retry) already fetched, via the
//     exact same manifest-diffing (daysNeedingSync) sync-candles.ts
//     uses. The tradeoff, already accepted: since candles aren't
//     scoped per-run, deleting one backtest run does NOT delete "its"
//     candles — they may still be needed by another run. Clearing the
//     backtest candle cache is therefore a separate, deliberate action
//     (emptying the bucket), never a side effect of deleting a run.
//   - Only the specific (instrument, timeframe) pairs a run's
//     backtest_run_feeds rows declare are synced — a run using only
//     15min EURUSD data never triggers a fetch for any other
//     timeframe/instrument, unlike the live sync which always covers
//     all 6 timeframes for whatever's logged.
//
// Idempotent and safe to re-run for the same run id, or run for a
// different run touching overlapping days/instruments — either way,
// already-synced (instrument, day) pairs are skipped via the manifest,
// never re-fetched.

import { Client as PgClient } from "pg";
import { S3Client } from "@aws-sdk/client-s3";
import { isCurrentUtcMonth, isUtcWeekend, pgDateToString } from "./tradeDays";
import { backtestUtcDays } from "./backtestDays";
import { manifestKey, monthManifestKey, daysNeedingSync } from "./candleSyncManifest";
import {
  readManifest,
  writeManifest,
  readMonthManifest,
  writeMonthManifest,
  mergeTimeframesIntoR2,
  fetchDayTickCsv,
  fetchMonthTickCsv,
} from "./candleSyncCore";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`::error::Missing required env var ${name}. See this script's header comment / the workflow file for the full list.`);
    process.exit(1);
  }
  return v;
}

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

type RunFeeds = {
  startDate: string | null;
  endDate: string | null;
  feeds: { instrument: string; timeframe: string }[];
};

/** Reads one backtest run's date range and declared (instrument, timeframe) feeds. */
async function fetchRunFeeds(pg: PgClient, runId: string): Promise<RunFeeds> {
  const runRes = await pg.query<{ start_date: string | Date; end_date: string | Date }>(
    `select start_date, end_date from backtest_runs where id = $1`,
    [runId]
  );
  if (runRes.rows.length === 0) {
    throw new Error(`No backtest_runs row found for id ${runId}`);
  }
  const feedsRes = await pg.query<{ instrument: string; timeframe: string }>(
    `select distinct instrument, timeframe from backtest_run_feeds where run_id = $1`,
    [runId]
  );
  return {
    startDate: pgDateToString(runRes.rows[0].start_date),
    endDate: pgDateToString(runRes.rows[0].end_date),
    feeds: feedsRes.rows,
  };
}

async function main() {
  const runId = requireEnv("BACKTEST_RUN_ID");
  const bucket = requireEnv("R2_BACKTEST_BUCKET_NAME");
  const s3 = makeS3Client();

  const pg = new PgClient({ connectionString: requireEnv("SUPABASE_DB_URL") });
  await pg.connect();

  let run: RunFeeds;
  try {
    run = await fetchRunFeeds(pg, runId);
  } finally {
    await pg.end();
  }

  const now = new Date();
  const days = backtestUtcDays(run.startDate, run.endDate, now);

  if (days.length === 0) {
    console.log("No closed UTC days in this run's date range yet — nothing to sync.");
    return;
  }
  if (run.feeds.length === 0) {
    console.log("This run declares no (instrument, timeframe) feeds — nothing to sync.");
    return;
  }

  // Only the timeframes this run's feeds actually declare get fetched —
  // fetchDayTickCsv/fetchMonthTickCsv still aggregate a tick archive
  // into ALL 6 timeframes at once (that's inherent to how tick
  // aggregation works — you get every timeframe's candles from the same
  // ticks for free), but mergeTimeframesIntoR2 is only asked to persist
  // the ones this run needs, so a run using only 15min data doesn't
  // pointlessly write 1min/1h/4h/1day files nobody asked for.
  const neededTimeframes = new Set(run.feeds.map((f) => f.timeframe));
  const instruments = [...new Set(run.feeds.map((f) => f.instrument))];

  console.log(`Backtest run ${runId}: ${instruments.length} instrument(s), ${days.length} closed day(s) in range, timeframes: ${[...neededTimeframes].join(", ")}.`);

  let totalDaysSynced = 0;
  let totalDaysSkipped = 0;

  for (const instrument of instruments) {
    console.log(`\n== ${instrument} ==`);
    const manifest = await readManifest(s3, bucket, instrument, manifestKey);
    const monthManifest = await readMonthManifest(s3, bucket, instrument, monthManifestKey);
    const daysToFetch = daysNeedingSync(manifest, [...days].sort());

    if (daysToFetch.length === 0) {
      console.log(`  Already fully synced (${days.length} day(s) in range), nothing to do.`);
      continue;
    }

    const currentMonthDays = daysToFetch.filter((day) => isCurrentUtcMonth(day.slice(0, 7), now));
    const pastMonthDays = daysToFetch.filter((day) => !isCurrentUtcMonth(day.slice(0, 7), now));

    for (const day of currentMonthDays) {
      const fetched = await fetchDayTickCsv(instrument, day, isUtcWeekend);
      if (!fetched) {
        totalDaysSkipped++;
        continue;
      }
      const month = day.slice(0, 7);
      const dayFullySynced = await mergeTimeframesIntoR2(s3, bucket, instrument, day, month, fetched.byTimeframe, neededTimeframes);
      if (dayFullySynced) {
        manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest, manifestKey);
        totalDaysSynced++;
        console.log(`  ✓ ${day} (via ${fetched.archiveSymbol})`);
      } else {
        totalDaysSkipped++;
      }
    }

    const pastMonthGroups = new Map<string, string[]>();
    for (const day of pastMonthDays) {
      const month = day.slice(0, 7);
      const group = pastMonthGroups.get(month) ?? [];
      group.push(day);
      pastMonthGroups.set(month, group);
    }

    for (const [month, daysInMonth] of pastMonthGroups) {
      if (monthManifest.has(month)) {
        for (const day of daysInMonth) manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest, manifestKey);
        totalDaysSynced += daysInMonth.length;
        console.log(`  ✓ ${month} already fully synced — marking ${daysInMonth.length} day(s) synced with no re-fetch`);
        continue;
      }

      const fetched = await fetchMonthTickCsv(instrument, month);
      if (!fetched) {
        totalDaysSkipped += daysInMonth.length;
        continue;
      }

      const monthFullySynced = await mergeTimeframesIntoR2(s3, bucket, instrument, month, month, fetched.candles, neededTimeframes);
      if (monthFullySynced) {
        for (const day of daysInMonth) manifest.add(day);
        await writeManifest(s3, bucket, instrument, manifest, manifestKey);
        monthManifest.add(month);
        await writeMonthManifest(s3, bucket, instrument, monthManifest, monthManifestKey);
        totalDaysSynced += daysInMonth.length;
        console.log(`  ✓ ${month} (via ${fetched.archiveSymbol}, covers ${daysInMonth.length} day(s)) — month marked fully synced`);
      } else {
        totalDaysSkipped += daysInMonth.length;
      }
    }
  }

  console.log(`\nDone. ${totalDaysSynced} day(s) synced, ${totalDaysSkipped} day(s) skipped (no archive available or a merge/upload error).`);
}

main().catch((err) => {
  console.error("::error::sync-backtest-candles.ts failed:", err);
  process.exit(1);
});
