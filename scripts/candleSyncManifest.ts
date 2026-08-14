// scripts/candleSyncManifest.ts
//
// Pure logic for the per-instrument sync-tracking manifests, extracted
// the same way as candleAggregation.ts and tradeDays.ts so it's
// testable without R2/network side effects.
//
// Two independent manifest files per instrument:
//
//   candles/{instrument}/synced-days.json   — which UTC days have had
//     their candles fetched/merged into R2. Lets the day-driven sync
//     (sync-candles.ts) answer "have I already fetched Aug 5 for
//     XAUUSD?" with a single cheap object read instead of
//     re-downloading and re-inspecting a month's candle file just to
//     find out.
//
//   candles/{instrument}/synced-months.json — which already-CLOSED
//     UTC months have had their whole monthly archive fetched and
//     fully merged into R2 (see isCurrentUtcMonth in tradeDays.ts —
//     the current, still-open month is never tracked here, only past
//     months fetched via fetchMonthTickCsv). Once a month is in this
//     manifest, every day in it is already sitting in R2's candle
//     files — a NEW trade added later on a different day in that same
//     month needs no re-fetch at all, just its day added to the day
//     manifest below so it isn't misreported as unsynced. Without this,
//     a new trade on a previously-untouched day within an
//     already-fully-fetched past month would force a full re-download
//     and re-aggregation of that month's archive just to pick up one
//     day whose candles were already in R2 from the earlier fetch.
//
// Both files share the same plain-JSON-array-of-strings shape and the
// same parse/serialize helpers below — they differ only in which R2 key
// they live under and what kind of string ("YYYY-MM-DD" vs "YYYY-MM")
// they hold. The candle-file layout in R2 stays month-keyed
// (candles/{instrument}/{tf}/{month}.json) and untouched by either
// manifest — both are pure bookkeeping objects, never a source of
// candle data themselves.

/** The R2 object key an instrument's synced-days manifest is stored/read under. */
export function manifestKey(instrument: string): string {
  return `candles/${instrument}/synced-days.json`;
}

/**
 * The R2 object key an instrument's synced-MONTHS manifest is
 * stored/read under — a separate object from manifestKey's per-day
 * file (see this file's header comment for why the two are split
 * rather than merged into one schema).
 */
export function monthManifestKey(instrument: string): string {
  return `candles/${instrument}/synced-months.json`;
}

/**
 * Parses a manifest file's raw JSON text into a Set of strings — used
 * for both the per-day manifest ("YYYY-MM-DD" entries) and the
 * per-month manifest ("YYYY-MM" entries), since both are just a JSON
 * array of strings under the hood. Returns an empty Set for
 * missing/empty/malformed input (a brand-new instrument with no
 * manifest yet, or any unexpected content) rather than throwing — same
 * "skip gracefully" convention the rest of this pipeline follows for
 * anything that can legitimately not exist yet.
 */
export function parseManifest(raw: string | null | undefined): Set<string> {
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((v): v is string => typeof v === "string"));
  } catch {
    return new Set();
  }
}

/** Serializes a manifest Set back to the sorted JSON array form it's stored as. */
export function serializeManifest(days: Set<string>): string {
  return JSON.stringify([...days].sort());
}

/**
 * Given a set of already-synced entries and the full list of candidate
 * entries a run needs, returns only the ones that still need fetching
 * this run. Generic over what the strings represent — used for both
 * "YYYY-MM-DD" days (already-closed days a trade spans — see
 * isUtcDayClosed in tradeDays.ts) and "YYYY-MM" months (already-closed
 * months whose whole archive hasn't been fetched yet).
 */
export function daysNeedingSync(alreadySynced: Set<string>, candidateDays: string[]): string[] {
  return candidateDays.filter((day) => !alreadySynced.has(day));
}
