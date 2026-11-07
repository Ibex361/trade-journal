import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { normalizeCsv, aggregateTicksToAllTimeframes, candleKey } from "../../scripts/candleAggregation";
import { archiveCandidates, archiveSymbolFor } from "../brokerSymbol";

// First 1,200 ticks of Exness' real daily archive file for XAUUSDc
// (cent feed), 2026-11-04. Expected candles below were computed
// independently of the aggregator (a separate script over the raw rows).
const TICKS = readFileSync(join(__dirname, "fixtures", "exness_XAUUSDc_ticks_sample.csv"), "utf8");

describe("Exness cent tick archive", () => {
  const candles = aggregateTicksToAllTimeframes(normalizeCsv(TICKS));

  it("reads the cent file's daily layout and builds 1-minute candles from bids", () => {
    const m1 = candles["1min"];
    expect(m1).toHaveLength(5);
    expect(m1[0]).toEqual({ t: 1793750400, o: 3938.366, h: 3939.938, l: 3937.608, c: 3939.216 });
    expect(m1[1]).toEqual({ t: 1793750460, o: 3939.168, h: 3939.168, l: 3936.455, c: 3936.498 });
  });

  it("produces every timeframe from the same ticks", () => {
    expect(Object.keys(candles).sort()).toEqual(["15min", "1day", "1h", "1min", "4h", "5min"]);
    // The first 5-minute candle spans the same ticks as the first 1-minute ones.
    expect(candles["5min"][0].o).toBe(3938.366);
  });

  it("is stored under the cent archive symbol's own R2 key, separate from the plain feed", () => {
    const sym = archiveSymbolFor("XAUUSD", "cent");
    expect(sym).toBe("XAUUSDc");
    expect(candleKey(sym, "5min", "2026-11")).toBe("candles/XAUUSDc/5min/2026-11.json");
    expect(candleKey("XAUUSD", "5min", "2026-11")).toBe("candles/XAUUSD/5min/2026-11.json");
  });

  it("fetches the cent feed by its exact name only", () => {
    expect(archiveCandidates("XAUUSDc")).toEqual(["XAUUSDc"]);
  });
});
