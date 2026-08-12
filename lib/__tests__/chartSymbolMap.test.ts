import { describe, it, expect } from "vitest";
import { resolveChartSymbol } from "../chartSymbolMap";

describe("resolveChartSymbol", () => {
  it("maps six-letter forex pairs to a slash pair", () => {
    expect(resolveChartSymbol("EURUSD")).toEqual({ twelveDataSymbol: "EUR/USD", kind: "forex" });
    expect(resolveChartSymbol("GBPJPY")).toEqual({ twelveDataSymbol: "GBP/JPY", kind: "forex" });
  });

  it("is case-insensitive on the input symbol", () => {
    expect(resolveChartSymbol("eurusd")).toEqual({ twelveDataSymbol: "EUR/USD", kind: "forex" });
  });

  it("maps gold/silver/platinum/palladium via the exact metals table, not the forex pattern", () => {
    expect(resolveChartSymbol("XAUUSD")).toEqual({ twelveDataSymbol: "XAU/USD", kind: "metal" });
    expect(resolveChartSymbol("XAGUSD")).toEqual({ twelveDataSymbol: "XAG/USD", kind: "metal" });
    expect(resolveChartSymbol("XPTUSD")).toEqual({ twelveDataSymbol: "XPT/USD", kind: "metal" });
    expect(resolveChartSymbol("XPDUSD")).toEqual({ twelveDataSymbol: "XPD/USD", kind: "metal" });
  });

  it("maps major indices to their Twelve Data ticker", () => {
    expect(resolveChartSymbol("US30")).toEqual({ twelveDataSymbol: "DJI", kind: "index" });
    expect(resolveChartSymbol("US500")).toEqual({ twelveDataSymbol: "SPX", kind: "index" });
    expect(resolveChartSymbol("USTEC")).toEqual({ twelveDataSymbol: "NDX", kind: "index" });
    expect(resolveChartSymbol("JPN225")).toEqual({ twelveDataSymbol: "JP225", kind: "index" });
  });

  it("maps DXY to its own index-style ticker, not a slash pair", () => {
    expect(resolveChartSymbol("DXY")).toEqual({ twelveDataSymbol: "DXY", kind: "index" });
  });

  it("maps major crypto pairs to a slash pair", () => {
    expect(resolveChartSymbol("BTCUSD")).toEqual({ twelveDataSymbol: "BTC/USD", kind: "crypto" });
    expect(resolveChartSymbol("ETHUSD")).toEqual({ twelveDataSymbol: "ETH/USD", kind: "crypto" });
    expect(resolveChartSymbol("ETHBTC")).toEqual({ twelveDataSymbol: "ETH/BTC", kind: "crypto" });
  });

  it("treats a Tether-settled crypto pair the same as its plain counterpart", () => {
    expect(resolveChartSymbol("BTCUSDT")).toEqual({ twelveDataSymbol: "BTC/USD", kind: "crypto" });
  });

  it("strips a Standard Cent 'c' suffix before matching the exact table", () => {
    expect(resolveChartSymbol("XAUUSDc")).toEqual({ twelveDataSymbol: "XAU/USD", kind: "metal" });
    expect(resolveChartSymbol("BTCUSDC")).toEqual({ twelveDataSymbol: "BTC/USD", kind: "crypto" });
  });

  it("returns null for an unmapped symbol rather than guessing", () => {
    expect(resolveChartSymbol("AAPL")).toBeNull();
    expect(resolveChartSymbol("SOME_WEIRD_TICKER")).toBeNull();
  });

  it("returns null for an empty symbol", () => {
    expect(resolveChartSymbol("")).toBeNull();
    expect(resolveChartSymbol("   ")).toBeNull();
  });

  it("an account override always wins over the built-in table", () => {
    const overrides = new Map([["EURUSD", "EUR/USD:OANDA"]]);
    expect(resolveChartSymbol("EURUSD", overrides)).toEqual({
      twelveDataSymbol: "EUR/USD:OANDA",
      kind: "forex",
    });
  });

  it("an override can map a symbol the built-in table has no entry for at all", () => {
    const overrides = new Map([["MYCUSTOMSYMBOL", "XYZ"]]);
    expect(resolveChartSymbol("MYCUSTOMSYMBOL", overrides)).toEqual({
      twelveDataSymbol: "XYZ",
      kind: "index",
    });
  });

  it("infers the override's kind from whether it contains a slash", () => {
    const overrides = new Map([
      ["FOO", "FOO/BAR"],
      ["BAZ", "BAZINDEX"],
    ]);
    expect(resolveChartSymbol("FOO", overrides)?.kind).toBe("forex");
    expect(resolveChartSymbol("BAZ", overrides)?.kind).toBe("index");
  });

  it("override lookup is uppercase-normalized, matching resolveChartSymbol's own normalization", () => {
    // Overrides are stored uppercased by upsertChartSymbolOverride, so a
    // lowercase key in the map (as might happen from a hand-built test
    // map) simply won't match — this documents that expectation.
    const overrides = new Map([["eurusd", "EUR/USD:CUSTOM"]]);
    expect(resolveChartSymbol("EURUSD", overrides)).toEqual({ twelveDataSymbol: "EUR/USD", kind: "forex" });
  });
});
