// scripts/candleAggregation.ts
//
// Pure logic extracted out of scripts/sync-candles.ts specifically so it
// can be unit tested (lib/__tests__/candleAggregation.test.ts) without
// pulling in that script's top-level env-var/S3-client side effects —
// sync-candles.ts imports these functions rather than defining them
// inline. Nothing in this file touches the network, R2, or Postgres.

export const TIMEFRAMES_MINUTES: Record<string, number> = {
  "1min": 1,
  "5min": 5,
  "15min": 15,
  "1h": 60,
  "4h": 240,
  "1day": 1440,
};

export type Candle = { t: number; o: number; h: number; l: number; c: number };

/** Every "YYYY-MM" month from start to end, inclusive on both ends. */
export function monthsBetween(startYYYYMM: string, endYYYYMM: string): string[] {
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

/**
 * The earliest month a given instrument's backfill should start from:
 * the month of its earliest logged trade, capped so a from-scratch sync
 * never backfills further back than maxBackfillMonths regardless of how
 * old the earliest trade is (see sync-candles.ts's MAX_BACKFILL_MONTHS
 * comment for why — no point fetching years of tick data nobody will
 * ever chart).
 */
export function computeStartMonth(earliestEntryDate: string | Date, maxBackfillMonths: number, now: Date = new Date()): string {
  // node-postgres returns a Postgres `date` column as a native JS Date
  // object, not a string, regardless of what the query result's TS type
  // claims — coerce defensively here so a bare .slice() call can't throw
  // TypeError: earliestEntryDate.slice is not a function against real
  // data, which a string-only fixture in tests wouldn't have caught.
  const asString =
    earliestEntryDate instanceof Date
      ? `${earliestEntryDate.getUTCFullYear()}-${String(earliestEntryDate.getUTCMonth() + 1).padStart(2, "0")}-${String(earliestEntryDate.getUTCDate()).padStart(2, "0")}`
      : earliestEntryDate;
  const earliestMonth = asString.slice(0, 7); // "YYYY-MM"
  const [y, m] = earliestMonth.split("-").map(Number);
  const earliestAsDate = new Date(Date.UTC(y, m - 1, 1));
  const cap = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - maxBackfillMonths, 1));
  const chosen = earliestAsDate > cap ? earliestAsDate : cap;
  return `${chosen.getUTCFullYear()}-${String(chosen.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The R2 object key a given (instrument, timeframe, month) candle file is stored/read under. */
export function candleKey(instrument: string, timeframe: string, month: string): string {
  return `candles/${instrument}/${timeframe}/${month}.json`;
}

/**
 * Parses "Timestamp,Symbol,Bid,Ask" tick rows and buckets the BID price
 * (never the ask — an explicit requirement of this migration) into
 * every timeframe in TIMEFRAMES_MINUTES simultaneously, one pass over
 * the ticks rather than one pass per timeframe, since ticks are the
 * expensive part to have fetched/parsed at all. Malformed rows (missing
 * fields, non-numeric bid, unparseable timestamp) are skipped rather
 * than aborting the whole aggregation — real archive files occasionally
 * have a stray blank line or truncated final row.
 */
export function aggregateTicksToAllTimeframes(csv: string): Record<string, Candle[]> {
  const buckets: Record<string, Map<number, Candle>> = {};
  for (const tf of Object.keys(TIMEFRAMES_MINUTES)) buckets[tf] = new Map();

  const lines = csv.split("\n");
  // Header is "Timestamp,Symbol,Bid,Ask" (case may vary) — skip line 0
  // unconditionally rather than sniffing for it, since every archive
  // file observed has exactly one header line.
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    const parts = line.split(",");
    if (parts.length < 3) continue;
    const [tsRaw, , bidRaw] = parts;
    const bid = Number(bidRaw);
    if (!Number.isFinite(bid)) continue;
    const ms = Date.parse(tsRaw.includes("Z") || tsRaw.includes("T") ? tsRaw : tsRaw.replace(" ", "T") + "Z");
    if (Number.isNaN(ms)) continue;

    for (const [tf, minutes] of Object.entries(TIMEFRAMES_MINUTES)) {
      const bucketMs = minutes * 60_000;
      const bucketStart = Math.floor(ms / bucketMs) * bucketMs;
      const bucketTimeSec = Math.floor(bucketStart / 1000);
      const existing = buckets[tf].get(bucketTimeSec);
      if (!existing) {
        buckets[tf].set(bucketTimeSec, { t: bucketTimeSec, o: bid, h: bid, l: bid, c: bid });
      } else {
        existing.h = Math.max(existing.h, bid);
        existing.l = Math.min(existing.l, bid);
        existing.c = bid; // ticks are in file order, so the last write is the latest close
      }
    }
  }

  const result: Record<string, Candle[]> = {};
  for (const tf of Object.keys(TIMEFRAMES_MINUTES)) {
    result[tf] = [...buckets[tf].values()].sort((a, b) => a.t - b.t);
  }
  return result;
}
