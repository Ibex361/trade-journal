import { describe, it, expect } from "vitest";
import { monthsBetween, candleKey, normalizeCsv, normalizedCsvBody, aggregateTicksToAllTimeframes, mergeCandles, TIMEFRAMES_MINUTES } from "../../scripts/candleAggregation";

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

describe("candleKey", () => {
  it("builds the R2 key from instrument, timeframe, and month", () => {
    expect(candleKey("XAUUSD", "15min", "2026-07")).toBe("candles/XAUUSD/15min/2026-07.json");
  });
});

describe("mergeCandles", () => {
  it("unions two disjoint candle arrays and sorts the result by time", () => {
    const existing = [{ t: 100, o: 1, h: 1, l: 1, c: 1 }];
    const incoming = [{ t: 50, o: 2, h: 2, l: 2, c: 2 }];
    expect(mergeCandles(existing, incoming)).toEqual([
      { t: 50, o: 2, h: 2, l: 2, c: 2 },
      { t: 100, o: 1, h: 1, l: 1, c: 1 },
    ]);
  });

  it("prefers incoming's candle on a timestamp collision", () => {
    const existing = [{ t: 100, o: 1, h: 1, l: 1, c: 1 }];
    const incoming = [{ t: 100, o: 9, h: 9, l: 9, c: 9 }];
    expect(mergeCandles(existing, incoming)).toEqual([{ t: 100, o: 9, h: 9, l: 9, c: 9 }]);
  });

  it("returns existing unchanged (just sorted) when incoming is empty", () => {
    const existing = [
      { t: 200, o: 1, h: 1, l: 1, c: 1 },
      { t: 100, o: 2, h: 2, l: 2, c: 2 },
    ];
    expect(mergeCandles(existing, [])).toEqual([
      { t: 100, o: 2, h: 2, l: 2, c: 2 },
      { t: 200, o: 1, h: 1, l: 1, c: 1 },
    ]);
  });

  it("returns incoming unchanged (just sorted) when existing is empty", () => {
    const incoming = [{ t: 100, o: 1, h: 1, l: 1, c: 1 }];
    expect(mergeCandles([], incoming)).toEqual(incoming);
  });

  it("handles both empty", () => {
    expect(mergeCandles([], [])).toEqual([]);
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
