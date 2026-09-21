// lib/backtestValidation.ts
//
// Pure, framework-free validation shared by the backtest API routes and
// the New Backtest form — kept out of the route files so it can be unit
// tested without Next/Supabase/network, and so the form can reject bad
// input with the exact same rules the server enforces (the server is
// still the authority; the form uses this only to fail fast).
//
// CLIENT-SAFE: imports nothing from Node. The one Node-only piece of this
// feature — the constant-time webhook secret check — lives in
// lib/backtestWebhookAuth.ts, because a client component (the form)
// imports THIS file and a client bundle can't import "node:crypto".

import { TIMEFRAMES_MINUTES } from "../scripts/candleAggregation";

export const BACKTEST_TIMEFRAMES = Object.keys(TIMEFRAMES_MINUTES);

// Generous upper bounds — not a product limit, just a guard against a
// malformed/abusive request creating thousands of rows or a multi-MB
// script row. A single-user app will never come near them legitimately.
export const MAX_FEEDS = 20;
export const MAX_SCRIPT_BYTES = 512 * 1024; // 512 KB of Python is far beyond any realistic strategy
export const MAX_NAME_LENGTH = 120;
export const MAX_INSTRUMENT_LENGTH = 30;

// Instruments are used as R2 key segments (candles/{instrument}/...) and
// in Exness archive URLs, so restrict to a strict allow-list of characters
// rather than trying to blacklist path tricks like "../" — same reasoning
// as ALLOWED_TIMEFRAMES in the chart-data route.
const INSTRUMENT_PATTERN = /^[A-Za-z0-9._-]+$/;

export type FeedInput = { instrument: string; timeframe: string };

export type TriggerInput = {
  name: string;
  scriptFilename: string;
  scriptSource: string;
  startDate: string;
  endDate: string;
  feeds: FeedInput[];
};

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function isRealDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T00:00:00Z`);
  // Round-trip catches "2026-02-31", which Date silently rolls to March 3.
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

/**
 * Validates and normalizes the body of POST /api/backtests/trigger.
 * `unknown` in, so a route can pass req.json() straight through without
 * trusting its shape. Feeds are trimmed, de-duplicated (same
 * instrument+timeframe twice would just create a duplicate feed name
 * inside Backtrader, which rejects it), and returned in first-seen order.
 */
export function validateTriggerInput(raw: unknown): ValidationResult<TriggerInput> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Request body must be a JSON object." };
  const body = raw as Record<string, unknown>;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) return { ok: false, error: "Give the backtest a name." };
  if (name.length > MAX_NAME_LENGTH) return { ok: false, error: `Name is too long (max ${MAX_NAME_LENGTH} characters).` };

  const scriptFilename = typeof body.scriptFilename === "string" ? body.scriptFilename.trim() : "";
  if (!scriptFilename.toLowerCase().endsWith(".py")) return { ok: false, error: "The strategy must be a .py file." };
  if (scriptFilename.length > 200) return { ok: false, error: "Script filename is too long." };

  const scriptSource = typeof body.scriptSource === "string" ? body.scriptSource : "";
  if (!scriptSource.trim()) return { ok: false, error: "The strategy file is empty." };
  if (new TextEncoder().encode(scriptSource).length > MAX_SCRIPT_BYTES) {
    return { ok: false, error: `The strategy file is too large (max ${MAX_SCRIPT_BYTES / 1024} KB).` };
  }

  const startDate = typeof body.startDate === "string" ? body.startDate : "";
  const endDate = typeof body.endDate === "string" ? body.endDate : "";
  if (!isRealDate(startDate)) return { ok: false, error: "Start date isn't a valid date." };
  if (!isRealDate(endDate)) return { ok: false, error: "End date isn't a valid date." };
  if (startDate > endDate) return { ok: false, error: "Start date must be on or before the end date." };

  if (!Array.isArray(body.feeds) || body.feeds.length === 0) return { ok: false, error: "Add at least one instrument and timeframe." };

  const feeds: FeedInput[] = [];
  const seen = new Set<string>();
  for (const item of body.feeds) {
    if (typeof item !== "object" || item === null) return { ok: false, error: "Each feed must be an object." };
    const f = item as Record<string, unknown>;
    const instrument = typeof f.instrument === "string" ? f.instrument.trim().toUpperCase() : "";
    const timeframe = typeof f.timeframe === "string" ? f.timeframe : "";
    if (!instrument) return { ok: false, error: "Every feed needs an instrument." };
    if (instrument.length > MAX_INSTRUMENT_LENGTH || !INSTRUMENT_PATTERN.test(instrument)) {
      return { ok: false, error: `"${instrument}" isn't a valid instrument name (letters, digits, dot, dash and underscore only).` };
    }
    if (!BACKTEST_TIMEFRAMES.includes(timeframe)) {
      return { ok: false, error: `"${timeframe}" isn't a supported timeframe (${BACKTEST_TIMEFRAMES.join(", ")}).` };
    }
    const key = `${instrument}|${timeframe}`;
    if (seen.has(key)) continue;
    seen.add(key);
    feeds.push({ instrument, timeframe });
  }
  if (feeds.length > MAX_FEEDS) return { ok: false, error: `Too many feeds (max ${MAX_FEEDS}).` };

  return { ok: true, value: { name, scriptFilename, scriptSource, startDate, endDate, feeds } };
}

export type WebhookPayload = { runId: string; status: "completed" | "failed"; error: string | null };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

/** Validates the JSON body run_backtest.py's notify_webhook sends: {run_id, status, error}. */
export function validateWebhookPayload(raw: unknown): ValidationResult<WebhookPayload> {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "Body must be a JSON object." };
  const b = raw as Record<string, unknown>;
  if (!isUuid(b.run_id)) return { ok: false, error: "run_id must be a UUID." };
  if (b.status !== "completed" && b.status !== "failed") return { ok: false, error: "status must be 'completed' or 'failed'." };
  const error = typeof b.error === "string" ? b.error : null;
  return { ok: true, value: { runId: b.run_id, status: b.status, error } };
}
