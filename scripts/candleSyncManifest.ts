// scripts/candleSyncManifest.ts
//
// Pure logic for the per-instrument "which UTC days have already been
// synced" manifest, extracted the same way as candleAggregation.ts and
// tradeDays.ts so it's testable without R2/network side effects.
//
// One manifest file per instrument at `candles/{instrument}/synced-days.json`
// — a plain JSON array of "YYYY-MM-DD" strings. This is what lets the
// day-driven sync (sync-candles.ts) answer "have I already fetched Aug 5
// for XAUUSD?" with a single cheap object read instead of re-downloading
// and re-inspecting a month's candle file just to find out. The
// candle-file layout in R2 stays month-keyed (candles/{instrument}/{tf}/{month}.json)
// and untouched by this — the manifest is a separate bookkeeping object,
// not a source of candle data itself.

/** The R2 object key an instrument's synced-days manifest is stored/read under. */
export function manifestKey(instrument: string): string {
  return `candles/${instrument}/synced-days.json`;
}

/**
 * Parses a manifest file's raw JSON text into a Set of "YYYY-MM-DD"
 * days. Returns an empty Set for missing/empty/malformed input (a
 * brand-new instrument with no manifest yet, or any unexpected content)
 * rather than throwing — same "skip gracefully" convention the rest of
 * this pipeline follows for anything that can legitimately not exist
 * yet.
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
 * Given a set of already-synced days and the full list of days a run
 * candidate needs (already filtered to closed days by the caller — see
 * isUtcDayClosed in tradeDays.ts), returns only the days that still
 * need fetching this run.
 */
export function daysNeedingSync(alreadySynced: Set<string>, candidateDays: string[]): string[] {
  return candidateDays.filter((day) => !alreadySynced.has(day));
}
