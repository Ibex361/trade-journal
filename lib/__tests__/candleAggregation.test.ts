import { describe, it, expect } from "vitest";
import { monthsBetween, computeStartMonth, candleKey, normalizeCsv, normalizedCsvBody, aggregateTicksToAllTimeframes, TIMEFRAMES_MINUTES } from "../../scripts/candleAggregation";

describe("monthsBetween", () => {
  it("returns a single month when start equals end", () => {
    expect(monthsBetween("2026-03", "2026-03")).toEqual(["2026-03"]);
  });

  it("returns every month within the same year", () => {
    expect(monthsBetween("2026-01", "2026-04")).toEqual(["2026-01", "2026-02", "2026-03", "2026-04"]);
  });

  it("rolls over a year boundary correctly", () => {
    expect(monthsBetween("2025-11", "2026-02")).toEqual(["2025-11", "2025-12", "2026-01", "2026-02"]);
  });
});

describe("computeStartMonth", () => {
  const now = new Date(Date.UTC(2026, 7, 13)); // 2026-08-13, matches "today" in this project's context

  it("starts from the earliest trade's month when that's within the backfill cap", () => {
    expect(computeStartMonth("2026-06-15", 24, now)).toBe("2026-06");
  });

  it("caps backfill at maxBackfillMonths even if the earliest trade is much older", () => {
    // 24 months before 2026-08 is 2024-08.
    expect(computeStartMonth("2020-01-01", 24, now)).toBe("2024-08");
  });

  it("respects a smaller maxBackfillMonths", () => {
    expect(computeStartMonth("2020-01-01", 3, now)).toBe("2026-05");
  });

  it("accepts a native Date object (what node-postgres actually returns for a `date` column), not just a string", () => {
    // Regression test: pg returns Postgres `date` columns as JS Date
    // objects at runtime regardless of the query result's TS type
    // annotation — a bare .slice() call on that value throws "X.slice
    // is not a function" the first time this runs against a real
    // database, which a string-only fixture can't catch.
    const asDate = new Date(Date.UTC(2026, 5, 15)); // 2026-06-15
    expect(computeStartMonth(asDate, 24, now)).toBe("2026-06");
  });

  it("a Date object still gets capped the same way a string does", () => {
    const asDate = new Date(Date.UTC(2020, 0, 1)); // 2020-01-01
    expect(computeStartMonth(asDate, 24, now)).toBe("2024-08");
  });
});

describe("candleKey", () => {
  it("builds the R2 key from instrument, timeframe, and month", () => {
    expect(candleKey("XAUUSD", "15min", "2026-07")).toBe("candles/XAUUSD/15min/2026-07.json");
  });
});

describe("normalizeCsv", () => {
  it("handles the daily XAUUSDm layout: quoted fields, Exness-first column order", () => {
    // Real format from the archive:
    // "Exness","Symbol","Timestamp","Bid","Ask"
    // "exness","XAUUSDm","2026-08-13 00:00:00.058Z",4414.327,4414.587
    const raw = [
      '"Exness","Symbol","Timestamp","Bid","Ask"',
      '"exness","XAUUSDm","2026-08-13 00:00:00.058Z",4414.327,4414.587',
      '"exness","XAUUSDm","2026-08-13 00:00:00.086Z",4414.387,4414.647',
    ].join("\n");
    const normalized = normalizeCsv(raw);
    const lines = normalized.split("\n").filter(Boolean);
    expect(lines[0]).toBe("Timestamp,Bid");
    expect(lines[1]).toBe("2026-08-13 00:00:00.058Z,4414.327");
    expect(lines[2]).toBe("2026-08-13 00:00:00.086Z,4414.387");
  });

  it("handles the monthly EURUSD layout: unquoted, Timestamp-first column order", () => {
    // Real format from the archive:
    // Timestamp,Exness,Symbol,Bid,Ask
    // 2026-08-02 21:05:04.170000+00:00,exness,EURUSD,1.15474,1.15508
    const raw = [
      "Timestamp,Exness,Symbol,Bid,Ask",
      "2026-08-02 21:05:04.170000+00:00,exness,EURUSD,1.15474,1.15508",
      "2026-08-02 21:05:05.669000+00:00,exness,EURUSD,1.15449,1.15499",
    ].join("\n");
    const normalized = normalizeCsv(raw);
    const lines = normalized.split("\n").filter(Boolean);
    expect(lines[0]).toBe("Timestamp,Bid");
    expect(lines[1]).toBe("2026-08-02 21:05:04.170000+00:00,1.15474");
    expect(lines[2]).toBe("2026-08-02 21:05:05.669000+00:00,1.15449");
  });

  it("returns an empty canonical header when the input has an unrecognised header", () => {
    const result = normalizeCsv("Date,Open,High,Low,Close\n2026-08-01,100,110,90,105");
    expect(result.trim()).toBe("Timestamp,Bid");
  });

  it("skips blank lines between data rows", () => {
    const raw = ["Timestamp,Exness,Symbol,Bid,Ask", "2026-08-01 10:00:00.000Z,exness,XAUUSD,2400.10,2400.30", "", "2026-08-01 10:00:01.000Z,exness,XAUUSD,2400.20,2400.40"].join("\n");
    const normalized = normalizeCsv(raw);
    const lines = normalized.split("\n").filter(Boolean);
    expect(lines).toHaveLength(3); // header + 2 data rows
  });
});

describe("normalizedCsvBody", () => {
  it("strips the header line so only data rows remain", () => {
    const normalized = "Timestamp,Bid\n2026-08-01 10:00:00Z,2400.10\n2026-08-01 10:00:01Z,2400.20";
    const body = normalizedCsvBody(normalized);
    expect(body).toBe("2026-08-01 10:00:00Z,2400.10\n2026-08-01 10:00:01Z,2400.20");
  });

  it("returns empty string for a header-only file", () => {
    expect(normalizedCsvBody("Timestamp,Bid\n")).toBe("");
    expect(normalizedCsvBody("Timestamp,Bid")).toBe("");
  });
});

describe("aggregateTicksToAllTimeframes", () => {
  // All test inputs use the canonical normalized format ("Timestamp,Bid")
  // since normalizeCsv() is responsible for translating archive-specific
  // layouts — aggregateTicksToAllTimeframes only sees normalized data.
  const header = "Timestamp,Bid";

  it("returns an empty candle array for every timeframe when given only a header", () => {
    const result = aggregateTicksToAllTimeframes(header);
    for (const tf of Object.keys(TIMEFRAMES_MINUTES)) {
      expect(result[tf]).toEqual([]);
    }
  });

  it("buckets ticks within the same minute into a single 1min candle using bid price", () => {
    const csv = [
      header,
      "2026-07-01 10:00:00.100,2400.10",
      "2026-07-01 10:00:30.500,2400.50",
      "2026-07-01 10:00:59.900,2400.20",
    ].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    expect(result["1min"]).toHaveLength(1);
    const candle = result["1min"][0];
    expect(candle.o).toBe(2400.1); // first tick's bid
    expect(candle.h).toBe(2400.5); // highest bid seen
    expect(candle.l).toBe(2400.1); // lowest bid seen
    expect(candle.c).toBe(2400.2); // last tick's bid
  });

  it("splits ticks that cross a minute boundary into separate candles", () => {
    const csv = [header, "2026-07-01 10:00:59.000,2400.00", "2026-07-01 10:01:00.000,2401.00"].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    expect(result["1min"]).toHaveLength(2);
    expect(result["1min"][0].c).toBe(2400.0);
    expect(result["1min"][1].o).toBe(2401.0);
  });

  it("derives every timeframe from the same tick pass, each internally consistent", () => {
    const csv = [
      header,
      "2026-07-01 10:00:00.000,2400.00",
      "2026-07-01 10:14:00.000,2405.00",
      "2026-07-01 10:15:00.000,2410.00",
    ].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    // The first two ticks fall in the same 15min bucket (10:00-10:15), the third starts a new one.
    expect(result["15min"]).toHaveLength(2);
    expect(result["15min"][0].o).toBe(2400.0);
    expect(result["15min"][0].c).toBe(2405.0);
    expect(result["15min"][1].o).toBe(2410.0);
    // All three ticks fall in the same 1h bucket.
    expect(result["1h"]).toHaveLength(1);
    expect(result["1h"][0].c).toBe(2410.0);
  });

  it("skips malformed rows instead of throwing", () => {
    const csv = [
      header,
      "2026-07-01 10:00:00.000,2400.00",
      "not-enough",
      "2026-07-01 10:00:10.000,not-a-number",
      "",
      "2026-07-01 10:00:20.000,2400.50",
    ].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    expect(result["1min"]).toHaveLength(1);
    expect(result["1min"][0].o).toBe(2400.0);
    expect(result["1min"][0].c).toBe(2400.5);
  });

  it("returns candles sorted ascending by time", () => {
    const csv = [
      header,
      "2026-07-01 12:00:00.000,2410.00",
      "2026-07-01 10:00:00.000,2400.00",
      "2026-07-01 11:00:00.000,2405.00",
    ].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    const times = result["1h"].map((c) => c.t);
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("parses timestamps in the daily format (3-digit ms, Z suffix, space separator)", () => {
    // "2026-08-13 00:00:00.058Z" — daily file format
    const csv = [header, "2026-08-13 00:00:00.058Z,4414.327", "2026-08-13 00:00:00.086Z,4414.387"].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    expect(result["1min"]).toHaveLength(1);
    expect(result["1min"][0].o).toBeCloseTo(4414.327);
    expect(result["1min"][0].c).toBeCloseTo(4414.387);
  });

  it("parses timestamps in the monthly format (6-digit µs, +00:00 offset, space separator)", () => {
    // "2026-08-02 21:05:04.170000+00:00" — monthly file format
    const csv = [header, "2026-08-02 21:05:04.170000+00:00,1.15474", "2026-08-02 21:05:05.669000+00:00,1.15449"].join("\n");
    const result = aggregateTicksToAllTimeframes(csv);
    expect(result["1min"]).toHaveLength(1);
    expect(result["1min"][0].o).toBeCloseTo(1.15474);
    expect(result["1min"][0].c).toBeCloseTo(1.15449);
  });

  it("round-trip: normalizeCsv output feeds correctly into aggregator for both real archive layouts", () => {
    // Daily XAUUSDm layout → normalize → aggregate
    const rawDaily = [
      '"Exness","Symbol","Timestamp","Bid","Ask"',
      '"exness","XAUUSDm","2026-08-13 00:00:00.058Z",4414.327,4414.587',
      '"exness","XAUUSDm","2026-08-13 00:00:01.000Z",4414.400,4414.660',
    ].join("\n");
    const dailyResult = aggregateTicksToAllTimeframes(normalizeCsv(rawDaily));
    expect(dailyResult["1min"]).toHaveLength(1);
    expect(dailyResult["1min"][0].o).toBeCloseTo(4414.327);

    // Monthly EURUSD layout → normalize → aggregate
    const rawMonthly = [
      "Timestamp,Exness,Symbol,Bid,Ask",
      "2026-08-02 21:05:04.170000+00:00,exness,EURUSD,1.15474,1.15508",
      "2026-08-02 21:05:05.669000+00:00,exness,EURUSD,1.15449,1.15499",
    ].join("\n");
    const monthlyResult = aggregateTicksToAllTimeframes(normalizeCsv(rawMonthly));
    expect(monthlyResult["1min"]).toHaveLength(1);
    expect(monthlyResult["1min"][0].o).toBeCloseTo(1.15474);
  });
});
