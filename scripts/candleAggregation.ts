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

// ---------------------------------------------------------------------
// CSV parsing — header-driven, quote-aware
// ---------------------------------------------------------------------

/**
 * Splits one CSV row into its field values, correctly handling RFC-4180
 * double-quoted fields (strips the outer quotes; a field may or may not
 * be quoted — the Exness tick archives are inconsistent about this even
 * within the same source).
 */
function splitCsvRow(row: string): string[] {
  const fields: string[] = [];
  let i = 0;
  while (i < row.length) {
    if (row[i] === '"') {
      // Quoted field: scan to the closing quote. The archives don't use
      // escaped quotes inside fields, so the first lone '"' ends it.
      const end = row.indexOf('"', i + 1);
      fields.push(end === -1 ? row.slice(i + 1) : row.slice(i + 1, end));
      i = end === -1 ? row.length : end + 2; // skip the closing '"' and the following ','
    } else {
      const end = row.indexOf(",", i);
      fields.push(end === -1 ? row.slice(i) : row.slice(i, end));
      i = end === -1 ? row.length : end + 1;
    }
  }
  return fields;
}

/**
 * Normalises raw tick CSV text to a canonical two-column form
 * "Timestamp,Bid\n..." regardless of the source file's column order
 * or quoting style. The Exness tick archives ship in (at least) two
 * different layouts:
 *
 *   Daily  (e.g. XAUUSDm):  "Exness","Symbol","Timestamp","Bid","Ask"
 *   Monthly (e.g. EURUSD):  Timestamp,Exness,Symbol,Bid,Ask
 *
 * Because column order and quoting both vary across files, parsing by
 * position (column 0 = Timestamp, column 2 = Bid) was silently
 * producing 0 candles from every row — the real column indices were
 * wrong in both cases. Reading the actual header and finding each
 * column by name is the only approach that's robust across both layouts
 * and any future variants Exness might introduce.
 *
 * Stripping down to just Timestamp + Bid also makes appendTodayBody()
 * safe to call regardless of column order in the source files: a
 * monthly CSV and its same-day top-up are guaranteed to share the same
 * two-column shape after normalization, so naive line-level
 * concatenation can't accidentally interleave two incompatible column
 * orderings under a single wrong header.
 */
export function normalizeCsv(raw: string): string {
  const lines = raw.split("\n");
  if (lines.length === 0) return "Timestamp,Bid\n";

  const headerFields = splitCsvRow(lines[0].trim()).map((f) => f.toLowerCase().trim());
  const tsIdx = headerFields.indexOf("timestamp");
  const bidIdx = headerFields.indexOf("bid");

  if (tsIdx === -1 || bidIdx === -1) {
    // Unrecognised header — return an empty canonical file; the caller
    // will see 0 candles and log/skip rather than crashing the whole run.
    return "Timestamp,Bid\n";
  }

  const out: string[] = ["Timestamp,Bid"];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const fields = splitCsvRow(line);
    if (fields.length <= Math.max(tsIdx, bidIdx)) continue;
    // Preserve the original timestamp string verbatim — Date.parse in
    // the aggregator handles both "2026-08-13 00:00:00.058Z" (daily,
    // 3-digit ms) and "2026-08-02 21:05:04.170000+00:00" (monthly,
    // 6-digit µs) after replacing the space separator with T.
    out.push(`${fields[tsIdx]},${fields[bidIdx]}`);
  }
  return out.join("\n");
}

/**
 * Strips the header line from an already-normalized CSV body so it can
 * be appended to another normalized CSV without duplicating the header.
 * Used by sync-candles.ts when splicing today's daily tick file onto
 * the end of a month's tick data.
 */
export function normalizedCsvBody(normalizedCsv: string): string {
  const nl = normalizedCsv.indexOf("\n");
  return nl === -1 ? "" : normalizedCsv.slice(nl + 1);
}

/**
 * Parses a normalized "Timestamp,Bid" tick CSV and buckets the BID
 * price into every timeframe in TIMEFRAMES_MINUTES simultaneously, one
 * pass over the ticks rather than one pass per timeframe, since ticks
 * are the expensive part to have fetched/parsed at all. Malformed rows
 * (missing fields, non-numeric bid, unparseable timestamp) are skipped
 * rather than aborting the whole aggregation — real archive files
 * occasionally have a stray blank line or truncated final row.
 *
 * Call normalizeCsv() first to handle the varying column orders and
 * quoting styles the Exness archive ships in (see that function's
 * comment for details).
 */
export function aggregateTicksToAllTimeframes(csv: string): Record<string, Candle[]> {
  const buckets: Record<string, Map<number, Candle>> = {};
  for (const tf of Object.keys(TIMEFRAMES_MINUTES)) buckets[tf] = new Map();

  const lines = csv.split("\n");
  // Header is "Timestamp,Bid" after normalization — skip line 0.
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const comma = line.indexOf(",");
    if (comma === -1) continue;
    const tsRaw = line.slice(0, comma);
    const bidRaw = line.slice(comma + 1);
    const bid = Number(bidRaw);
    if (!Number.isFinite(bid)) continue;
    // Both real timestamp formats become valid ISO 8601 after replacing
    // the space separator with T:
    //   "2026-08-13 00:00:00.058Z"       → "2026-08-13T00:00:00.058Z"
    //   "2026-08-02 21:05:04.170000+00:00" → "2026-08-02T21:05:04.170000+00:00"
    // JS Date.parse handles both correctly (6-digit microsecond fraction
    // is truncated silently; the +00:00 offset is respected).
    const isoTs = tsRaw.includes("T") ? tsRaw : tsRaw.replace(" ", "T");
    const ms = Date.parse(isoTs);
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
