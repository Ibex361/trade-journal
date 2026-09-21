import { describe, it, expect } from "vitest";
import { formatRunDate, formatDuration, summarizeInstruments, summarizeTimeframes, isActiveStatus, pollDelayFor, isStale, POLL_INTERVAL_MS, STALE_AFTER_MS, reconcileTradeCount } from "../backtestFormat";

describe("formatRunDate", () => {
  it("formats a calendar date without shifting a day in any timezone", () => {
    expect(formatRunDate("2026-01-05")).toBe("Jan 5, 2026");
    expect(formatRunDate("2026-12-31")).toBe("Dec 31, 2026");
  });
  it("returns garbage input unchanged rather than 'Invalid Date'", () => {
    expect(formatRunDate("nope")).toBe("nope");
  });
});

describe("formatDuration", () => {
  const t0 = "2026-01-01T00:00:00Z";
  it("seconds / minutes / hours", () => {
    expect(formatDuration(t0, "2026-01-01T00:00:42Z")).toBe("42s");
    expect(formatDuration(t0, "2026-01-01T00:02:14Z")).toBe("2m 14s");
    expect(formatDuration(t0, "2026-01-01T01:05:00Z")).toBe("1h 05m");
  });
  it("null while unfinished or on bad/negative input", () => {
    expect(formatDuration(t0, null)).toBeNull();
    expect(formatDuration(t0, "garbage")).toBeNull();
    expect(formatDuration("2026-01-02T00:00:00Z", t0)).toBeNull();
  });
});

describe("summarizeInstruments", () => {
  it("dedupes, sorts and joins", () => {
    expect(summarizeInstruments([{ instrument: "XAUUSD" }, { instrument: "EURUSD" }, { instrument: "EURUSD" }])).toBe("EURUSD, XAUUSD");
  });
  it("caps with a +N suffix", () => {
    const feeds = ["A", "B", "C", "D", "E"].map((instrument) => ({ instrument }));
    expect(summarizeInstruments(feeds)).toBe("A, B, C +2");
  });
  it("dash when empty", () => {
    expect(summarizeInstruments([])).toBe("—");
  });
});

describe("summarizeTimeframes", () => {
  it("orders fine to coarse regardless of input order", () => {
    expect(summarizeTimeframes([{ timeframe: "1h" }, { timeframe: "15min" }, { timeframe: "1day" }, { timeframe: "15min" }])).toBe("15min, 1h, 1day");
  });
  it("dash when empty", () => {
    expect(summarizeTimeframes([])).toBe("—");
  });
});

describe("polling policy", () => {
  const created = "2026-01-01T00:00:00Z";
  const t0 = new Date(created).getTime();

  it("only pending/running are active", () => {
    expect(isActiveStatus("pending")).toBe(true);
    expect(isActiveStatus("running")).toBe(true);
    expect(isActiveStatus("completed")).toBe(false);
    expect(isActiveStatus("failed")).toBe(false);
    expect(isActiveStatus("anything-else")).toBe(false);
  });

  it("polls active runs, and stops on terminal ones", () => {
    expect(pollDelayFor("pending", created, t0 + 1000)).toBe(POLL_INTERVAL_MS);
    expect(pollDelayFor("running", created, t0 + 1000)).toBe(POLL_INTERVAL_MS);
    expect(pollDelayFor("completed", created, t0 + 1000)).toBeNull();
    expect(pollDelayFor("failed", created, t0 + 1000)).toBeNull();
  });

  it("stops polling a run stuck 'active' longer than the workflow could possibly run", () => {
    expect(pollDelayFor("running", created, t0 + STALE_AFTER_MS - 1)).toBe(POLL_INTERVAL_MS);
    expect(pollDelayFor("running", created, t0 + STALE_AFTER_MS + 1)).toBeNull();
  });

  it("the stale threshold exceeds the workflow's 6h hard timeout", () => {
    expect(STALE_AFTER_MS).toBeGreaterThan(6 * 60 * 60 * 1000);
  });

  it("isStale agrees with pollDelayFor and never flags a finished run", () => {
    expect(isStale("running", created, t0 + STALE_AFTER_MS + 1)).toBe(true);
    expect(isStale("running", created, t0 + 1000)).toBe(false);
    expect(isStale("completed", created, t0 + STALE_AFTER_MS * 10)).toBe(false);
    expect(isStale("failed", created, t0 + STALE_AFTER_MS * 10)).toBe(false);
  });

  it("a bad created_at never crashes or false-flags stale (keeps polling)", () => {
    expect(pollDelayFor("running", "garbage", t0)).toBe(POLL_INTERVAL_MS);
    expect(isStale("running", "garbage", t0)).toBe(false);
  });
});

describe("reconcileTradeCount", () => {
  it("match when the table and Backtrader agree", () => {
    expect(reconcileTradeCount(307, 307)).toEqual({ kind: "match" });
    expect(reconcileTradeCount(0, 0)).toEqual({ kind: "match" });
  });
  it("mismatch reports both numbers, in either direction", () => {
    expect(reconcileTradeCount(300, 307)).toEqual({ kind: "mismatch", shown: 300, reported: 307 });
    expect(reconcileTradeCount(310, 307)).toEqual({ kind: "mismatch", shown: 310, reported: 307 });
  });
  it("unknown when Backtrader reported no count (never falsely 'match')", () => {
    expect(reconcileTradeCount(0, null)).toEqual({ kind: "unknown" });
    expect(reconcileTradeCount(50, null)).toEqual({ kind: "unknown" });
  });
});
