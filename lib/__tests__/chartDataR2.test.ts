import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the AWS SDK so serveChartData runs end-to-end with no network.
const store = new Map<string, unknown>();
const requestedKeys: { bucket: string; key: string }[] = [];
vi.mock("@aws-sdk/client-s3", () => {
  class GetObjectCommand {
    constructor(public input: { Bucket: string; Key: string }) {}
  }
  class S3Client {
    async send(cmd: GetObjectCommand) {
      requestedKeys.push({ bucket: cmd.input.Bucket, key: cmd.input.Key });
      const hit = store.get(`${cmd.input.Bucket}/${cmd.input.Key}`);
      if (hit === undefined) {
        const e = new Error("nope") as Error & { name: string };
        e.name = "NoSuchKey";
        throw e;
      }
      const { Readable } = await import("node:stream");
      return { Body: Readable.from([Buffer.from(JSON.stringify(hit))]) };
    }
  }
  return { S3Client, GetObjectCommand };
});

import { serveChartData, parseRangeParam } from "../chartDataR2";

const OPTS = { bucket: "bt-bucket", bucketEnvName: "R2_BACKTEST_BUCKET_NAME", notSyncedMessage: (i: string) => `none for ${i}` };
const q = (o: Record<string, string>) => new URLSearchParams(o);
const base = { symbol: "EURUSD", timeframe: "15min", start: "2026-01-05 00:00:00", end: "2026-01-05 01:00:00" };
const candle = (t: number) => ({ t, o: 1, h: 2, l: 0.5, c: 1.5 });
const T0 = Date.UTC(2026, 0, 5) / 1000;

beforeEach(() => {
  store.clear();
  requestedKeys.length = 0;
  process.env.R2_ACCOUNT_ID = "a";
  process.env.R2_ACCESS_KEY_ID = "k";
  process.env.R2_SECRET_ACCESS_KEY = "s";
});

async function json(res: Response) {
  return { status: res.status, body: await res.json() };
}

describe("serveChartData", () => {
  it("returns candles in range, sorted, in the chart's {time,open,...} shape", async () => {
    store.set("bt-bucket/candles/EURUSD/15min/2026-01.json", [candle(T0 + 1800), candle(T0), candle(T0 + 900), candle(T0 + 999999)]);
    const { status, body } = await json(await serveChartData(q(base), OPTS));
    expect(status).toBe(200);
    expect(body.candles.map((c: { time: number }) => c.time)).toEqual([T0, T0 + 900, T0 + 1800]);
    expect(body.candles[0]).toEqual({ time: T0, open: 1, high: 2, low: 0.5, close: 1.5 });
  });

  it("reads from the bucket it was told to (backtest vs live isolation)", async () => {
    store.set("bt-bucket/candles/EURUSD/15min/2026-01.json", [candle(T0)]);
    await serveChartData(q(base), OPTS);
    expect(requestedKeys.every((r) => r.bucket === "bt-bucket")).toBe(true);
  });

  it("reads one file per month a range spans", async () => {
    store.set("bt-bucket/candles/EURUSD/15min/2026-01.json", [candle(T0)]);
    await serveChartData(q({ ...base, start: "2026-01-30 00:00:00", end: "2026-03-02 00:00:00" }), OPTS);
    expect(requestedKeys.map((r) => r.key)).toEqual([
      "candles/EURUSD/15min/2026-01.json",
      "candles/EURUSD/15min/2026-02.json",
      "candles/EURUSD/15min/2026-03.json",
    ]);
  });

  it("404 with the caller's message when no month exists", async () => {
    const { status, body } = await json(await serveChartData(q(base), OPTS));
    expect(status).toBe(404);
    expect(body.error).toBe("none for EURUSD");
  });

  it("a partially-synced range still returns what exists", async () => {
    store.set("bt-bucket/candles/EURUSD/15min/2026-01.json", [candle(T0)]);
    const { status, body } = await json(await serveChartData(q({ ...base, end: "2026-02-10 00:00:00" }), OPTS));
    expect(status).toBe(200);
    expect(body.candles).toHaveLength(1);
  });

  it("500 when the bucket env var is unset, naming which one", async () => {
    const { status, body } = await json(await serveChartData(q(base), { ...OPTS, bucket: undefined }));
    expect(status).toBe(500);
    expect(body.error).toMatch(/R2_BACKTEST_BUCKET_NAME/);
  });

  it("400s on bad input", async () => {
    for (const bad of [
      { ...base, symbol: "" },
      { ...base, timeframe: "3min" },
      { ...base, start: "" },
      { ...base, start: "garbage" },
    ]) {
      expect((await serveChartData(q(bad), OPTS)).status).toBe(400);
    }
  });

  it("rejects path-traversal in symbol so it can never address another key prefix", async () => {
    for (const sym of ["../secret", "EUR/USD", "a b", "x".repeat(31)]) {
      const res = await serveChartData(q({ ...base, symbol: sym }), OPTS);
      expect(res.status).toBe(400);
    }
    expect(requestedKeys).toEqual([]); // never even reached R2
  });

  it("502 on a real R2 failure (not misreported as 'not synced')", async () => {
    const mod = await import("@aws-sdk/client-s3");
    const spy = vi.spyOn(mod.S3Client.prototype, "send").mockRejectedValueOnce(Object.assign(new Error("boom"), { name: "AccessDenied" }));
    const { status } = await json(await serveChartData(q(base), OPTS));
    expect(status).toBe(502);
    spy.mockRestore();
  });
});

describe("parseRangeParam", () => {
  it("parses chartTradeWindow's 'YYYY-MM-DD HH:mm:ss' as UTC", () => {
    expect(parseRangeParam("2026-01-05 00:00:00")).toBe(T0);
  });
  it("NaN on garbage", () => {
    expect(Number.isNaN(parseRangeParam("nope"))).toBe(true);
  });
});
