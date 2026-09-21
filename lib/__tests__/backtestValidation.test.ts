import { describe, it, expect } from "vitest";
import {
  validateTriggerInput,
  validateWebhookPayload,
  isUuid,
  MAX_FEEDS,
  MAX_SCRIPT_BYTES,
  MAX_NAME_LENGTH,
  BACKTEST_TIMEFRAMES,
} from "../backtestValidation";
import { bearerMatches } from "../backtestWebhookAuth";
import { TIMEFRAMES_MINUTES } from "../../scripts/candleAggregation";

const good = () => ({
  name: "EMA cross",
  scriptFilename: "ema.py",
  scriptSource: "import backtrader as bt\nclass S(bt.Strategy): pass\n",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  feeds: [{ instrument: "EURUSD", timeframe: "15min" }],
});

function fail(raw: unknown): string {
  const r = validateTriggerInput(raw);
  if (r.ok) throw new Error("expected validation to fail");
  return r.error;
}

describe("validateTriggerInput — happy path", () => {
  it("accepts a valid body and normalizes it", () => {
    const r = validateTriggerInput({ ...good(), name: "  EMA cross  ", feeds: [{ instrument: " eurusd ", timeframe: "15min" }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.name).toBe("EMA cross");
      expect(r.value.feeds).toEqual([{ instrument: "EURUSD", timeframe: "15min" }]);
    }
  });

  it("supports multi-asset, multi-timeframe feeds", () => {
    const r = validateTriggerInput({
      ...good(),
      feeds: [
        { instrument: "EURUSD", timeframe: "15min" },
        { instrument: "EURUSD", timeframe: "1h" },
        { instrument: "XAUUSD", timeframe: "15min" },
      ],
    });
    expect(r.ok && r.value.feeds).toHaveLength(3);
  });

  it("collapses duplicate feeds, keeping first-seen order", () => {
    const r = validateTriggerInput({
      ...good(),
      feeds: [
        { instrument: "XAUUSD", timeframe: "1h" },
        { instrument: "EURUSD", timeframe: "15min" },
        { instrument: "xauusd", timeframe: "1h" },
      ],
    });
    expect(r.ok && r.value.feeds).toEqual([
      { instrument: "XAUUSD", timeframe: "1h" },
      { instrument: "EURUSD", timeframe: "15min" },
    ]);
  });

  it("accepts a single-day range", () => {
    expect(validateTriggerInput({ ...good(), startDate: "2026-02-01", endDate: "2026-02-01" }).ok).toBe(true);
  });

  it("accepts .PY uppercase extension", () => {
    expect(validateTriggerInput({ ...good(), scriptFilename: "STRAT.PY" }).ok).toBe(true);
  });
});

describe("validateTriggerInput — rejections", () => {
  it("non-object bodies", () => {
    expect(fail(null)).toMatch(/JSON object/);
    expect(fail("x")).toMatch(/JSON object/);
    expect(fail(undefined)).toMatch(/JSON object/);
  });

  it("blank or oversized name", () => {
    expect(fail({ ...good(), name: "   " })).toMatch(/name/i);
    expect(fail({ ...good(), name: "x".repeat(MAX_NAME_LENGTH + 1) })).toMatch(/too long/);
  });

  it("non-.py filename", () => {
    expect(fail({ ...good(), scriptFilename: "strategy.txt" })).toMatch(/\.py/);
    expect(fail({ ...good(), scriptFilename: "" })).toMatch(/\.py/);
  });

  it("empty or whitespace script", () => {
    expect(fail({ ...good(), scriptSource: "   \n " })).toMatch(/empty/);
  });

  it("oversized script (measured in bytes, not characters)", () => {
    // 3-byte chars: string length under the limit, byte length over it
    const src = "€".repeat(Math.ceil(MAX_SCRIPT_BYTES / 3) + 1);
    expect(src.length).toBeLessThan(MAX_SCRIPT_BYTES);
    expect(fail({ ...good(), scriptSource: src })).toMatch(/too large/);
  });

  it("impossible calendar dates that Date would silently roll over", () => {
    expect(fail({ ...good(), startDate: "2026-02-31" })).toMatch(/Start date/);
    expect(fail({ ...good(), endDate: "2026-13-01" })).toMatch(/End date/);
    expect(fail({ ...good(), startDate: "2026-1-1" })).toMatch(/Start date/);
    expect(fail({ ...good(), startDate: "" })).toMatch(/Start date/);
  });

  it("start after end", () => {
    expect(fail({ ...good(), startDate: "2026-04-01", endDate: "2026-03-01" })).toMatch(/on or before/);
  });

  it("missing / empty / non-array feeds", () => {
    expect(fail({ ...good(), feeds: [] })).toMatch(/at least one/);
    expect(fail({ ...good(), feeds: undefined })).toMatch(/at least one/);
    expect(fail({ ...good(), feeds: "EURUSD" })).toMatch(/at least one/);
  });

  it("feed with blank instrument or bad shape", () => {
    expect(fail({ ...good(), feeds: [{ instrument: "  ", timeframe: "15min" }] })).toMatch(/instrument/);
    expect(fail({ ...good(), feeds: [null] })).toMatch(/object/);
  });

  it("unsupported timeframe names the supported ones", () => {
    const msg = fail({ ...good(), feeds: [{ instrument: "EURUSD", timeframe: "3min" }] });
    expect(msg).toMatch(/3min/);
    expect(msg).toMatch(/15min/);
  });

  it("path-traversal-ish or otherwise unsafe instrument names (used as R2 key segments)", () => {
    for (const bad of ["../etc", "EUR/USD", "EUR USD", "EURUSD;drop", "a\\b", "EUR%2fUSD", "é"]) {
      expect(fail({ ...good(), feeds: [{ instrument: bad, timeframe: "15min" }] })).toMatch(/valid instrument/);
    }
  });

  it("accepts realistic instrument names", () => {
    for (const ok of ["EURUSD", "XAUUSD", "BTCUSD", "US30", "BTC_USD", "USTEC", "DE.30"]) {
      expect(validateTriggerInput({ ...good(), feeds: [{ instrument: ok, timeframe: "1h" }] }).ok).toBe(true);
    }
  });

  it("too many DISTINCT feeds", () => {
    const feeds = Array.from({ length: MAX_FEEDS + 1 }, (_, i) => ({ instrument: `SYM${i}`, timeframe: "1h" }));
    expect(fail({ ...good(), feeds })).toMatch(/Too many feeds/);
  });

  it("duplicates don't count toward the feed cap", () => {
    const feeds = Array.from({ length: MAX_FEEDS + 5 }, () => ({ instrument: "EURUSD", timeframe: "1h" }));
    const r = validateTriggerInput({ ...good(), feeds });
    expect(r.ok && r.value.feeds).toHaveLength(1);
  });
});

describe("timeframe table", () => {
  it("is exactly the candle pipeline's timeframe set (no drift from candleAggregation.ts)", () => {
    expect(BACKTEST_TIMEFRAMES).toEqual(Object.keys(TIMEFRAMES_MINUTES));
  });
});

describe("bearerMatches", () => {
  it("accepts the exact secret", () => {
    expect(bearerMatches("Bearer s3cret-value", "s3cret-value")).toBe(true);
  });
  it("rejects wrong secret of same length", () => {
    expect(bearerMatches("Bearer s3cret-valuX", "s3cret-value")).toBe(false);
  });
  it("rejects wrong length without throwing (timingSafeEqual would throw)", () => {
    expect(bearerMatches("Bearer short", "s3cret-value")).toBe(false);
    expect(bearerMatches("Bearer s3cret-value-longer", "s3cret-value")).toBe(false);
  });
  it("rejects missing header or unset secret — never fails open", () => {
    expect(bearerMatches(null, "s3cret")).toBe(false);
    expect(bearerMatches("Bearer s3cret", undefined)).toBe(false);
    expect(bearerMatches("Bearer ", "")).toBe(false);
    expect(bearerMatches("", "")).toBe(false);
  });
  it("requires the Bearer scheme", () => {
    expect(bearerMatches("s3cret", "s3cret")).toBe(false);
    expect(bearerMatches("Basic s3cret", "s3cret")).toBe(false);
  });
});

describe("validateWebhookPayload", () => {
  const id = "123e4567-e89b-12d3-a456-426614174000";
  it("accepts exactly what run_backtest.py's notify_webhook sends", () => {
    expect(validateWebhookPayload({ run_id: id, status: "completed", error: null })).toEqual({
      ok: true,
      value: { runId: id, status: "completed", error: null },
    });
    const failed = validateWebhookPayload({ run_id: id, status: "failed", error: "boom" });
    expect(failed.ok && failed.value.error).toBe("boom");
  });
  it("rejects a non-UUID run_id and unknown statuses", () => {
    expect(validateWebhookPayload({ run_id: "nope", status: "completed" }).ok).toBe(false);
    expect(validateWebhookPayload({ run_id: id, status: "running" }).ok).toBe(false);
    expect(validateWebhookPayload(null).ok).toBe(false);
  });
  it("treats a non-string error as null rather than rejecting", () => {
    const r = validateWebhookPayload({ run_id: id, status: "completed", error: 5 });
    expect(r.ok && r.value.error).toBeNull();
  });
});

describe("isUuid", () => {
  it("accepts either case, rejects junk", () => {
    expect(isUuid("123E4567-E89B-12D3-A456-426614174000")).toBe(true);
    expect(isUuid("123e4567e89b12d3a456426614174000")).toBe(false);
    expect(isUuid(42)).toBe(false);
  });
});
