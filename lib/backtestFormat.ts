// lib/backtestFormat.ts
//
// Small pure display helpers for the Backtest pages, kept out of the
// components so they can be unit tested.

import type { BacktestFeed } from "./backtests";

/** "2026-01-05" -> "Jan 5, 2026" without a timezone shift (parsed as a plain calendar date, not an instant). */
export function formatRunDate(d: string): string {
  const [y, m, day] = d.split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

/**
 * Compact "how long did it take" from two ISO timestamps, e.g. "2m 14s",
 * "1h 05m". Null if the run hasn't finished or the timestamps are bad.
 */
export function formatDuration(startIso: string, endIso: string | null): string | null {
  if (!endIso) return null;
  const ms = new Date(endIso).getTime() - new Date(startIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const totalSeconds = Math.round(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, "0")}m`;
  if (m > 0) return `${m}m ${String(s).padStart(2, "0")}s`;
  return `${s}s`;
}

/**
 * Summarises a run's feeds for a list row: distinct instruments joined,
 * capped so a 15-feed run doesn't blow out the row — "EURUSD, GBPUSD +3".
 */
export function summarizeInstruments(feeds: Pick<BacktestFeed, "instrument">[], max = 3): string {
  const distinct = [...new Set(feeds.map((f) => f.instrument))].sort();
  if (distinct.length === 0) return "—";
  if (distinct.length <= max) return distinct.join(", ");
  return `${distinct.slice(0, max).join(", ")} +${distinct.length - max}`;
}

/** Distinct timeframes across feeds, in the app's natural fine-to-coarse order. */
const TF_ORDER = ["1min", "5min", "15min", "1h", "4h", "1day"];
export function summarizeTimeframes(feeds: Pick<BacktestFeed, "timeframe">[]): string {
  const distinct = [...new Set(feeds.map((f) => f.timeframe))].sort((a, b) => TF_ORDER.indexOf(a) - TF_ORDER.indexOf(b));
  return distinct.length === 0 ? "—" : distinct.join(", ");
}

// ---------------------------------------------------------------------
// Polling policy
// ---------------------------------------------------------------------

/** A run is "active" (worth polling) until it reaches a terminal status. */
export function isActiveStatus(status: string): boolean {
  return status === "pending" || status === "running";
}

// How often to re-read an active run. The workflow itself takes minutes, so
// a few seconds is plenty responsive without hammering Supabase.
export const POLL_INTERVAL_MS = 5000;

// A run that has been "active" longer than the workflow's own hard timeout
// (backtest.yml: timeout-minutes 360) can't still be genuinely running --
// GitHub would have killed it and the last-resort step marked it failed.
// If the row still says active past this, something outside our control
// (e.g. the failure step itself couldn't reach the DB) left it stale.
// Polling forever on it would be a silent infinite loop, so the UI stops
// polling and says so instead.
export const STALE_AFTER_MS = 6 * 60 * 60 * 1000 + 10 * 60 * 1000; // 6h timeout + 10min slack

/**
 * The interval to poll at, or null to stop. Polls only while active and
 * not stale. `nowMs` is injected so this stays a pure, testable function.
 */
export function pollDelayFor(status: string, createdAtIso: string, nowMs: number): number | null {
  if (!isActiveStatus(status)) return null;
  const created = new Date(createdAtIso).getTime();
  if (Number.isFinite(created) && nowMs - created > STALE_AFTER_MS) return null;
  return POLL_INTERVAL_MS;
}

/** True when a run is still marked active but has outlived the workflow's timeout. */
export function isStale(status: string, createdAtIso: string, nowMs: number): boolean {
  if (!isActiveStatus(status)) return false;
  const created = new Date(createdAtIso).getTime();
  return Number.isFinite(created) && nowMs - created > STALE_AFTER_MS;
}

// ---------------------------------------------------------------------
// Trades-table reconciliation
// ---------------------------------------------------------------------

export type Reconciliation =
  | { kind: "match" }
  | { kind: "unknown" }
  | { kind: "mismatch"; shown: number; reported: number };

/**
 * Compares the number of trade rows actually shown in the trades table
 * against the closed-trade count Backtrader's own TradeAnalyzer reported.
 *
 * They should be equal: the runner records exactly the trades Backtrader
 * closes. If they differ, something is wrong (a trade lost in the insert,
 * or a paging cut-off) and the page must say so, because a table with
 * 5,000 rows beside a headline of "5,003 closed trades" would otherwise
 * look like a silent bug -- or worse, be trusted. `unknown` is when
 * Backtrader reported no count at all (analysis missing / analyzer errored).
 */
export function reconcileTradeCount(shownRows: number, reportedClosed: number | null): Reconciliation {
  if (reportedClosed === null) return { kind: "unknown" };
  return shownRows === reportedClosed ? { kind: "match" } : { kind: "mismatch", shown: shownRows, reported: reportedClosed };
}
