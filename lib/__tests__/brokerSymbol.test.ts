import { describe, it, expect } from "vitest";
import { parseBrokerSymbol, normalizeBrokerSymbol, archiveSymbolFor, archiveCandidates, baseSymbol } from "../brokerSymbol";

describe("parseBrokerSymbol", () => {
  it("splits the cent and standard suffixes off an uppercase base", () => {
    expect(parseBrokerSymbol("XAUUSDc")).toEqual({ raw: "XAUUSDc", base: "XAUUSD", suffix: "c" });
    expect(parseBrokerSymbol("EURUSDm")).toEqual({ raw: "EURUSDm", base: "EURUSD", suffix: "m" });
  });

  it("returns no suffix for plain (Pro) symbols", () => {
    expect(parseBrokerSymbol("XAUUSD")).toEqual({ raw: "XAUUSD", base: "XAUUSD", suffix: "" });
  });

  it("does NOT mistake symbols that legitimately end in an uppercase C for cent symbols", () => {
    expect(parseBrokerSymbol("USTEC").suffix).toBe("");
    expect(parseBrokerSymbol("ETHBTC").suffix).toBe("");
    expect(parseBrokerSymbol("USTECc")).toMatchObject({ base: "USTEC", suffix: "c" });
  });

  it("handles short and digit-containing bases", () => {
    expect(parseBrokerSymbol("US30c")).toMatchObject({ base: "US30", suffix: "c" });
    expect(parseBrokerSymbol("DXYc")).toMatchObject({ base: "DXY", suffix: "c" });
  });

  it("treats the amplified-index marker's lowercase x as part of the base", () => {
    expect(parseBrokerSymbol("US30_x10")).toMatchObject({ base: "US30_x10", suffix: "" });
    expect(parseBrokerSymbol("US30_x10c")).toMatchObject({ base: "US30_x10", suffix: "c" });
  });

  it("trims whitespace", () => {
    expect(parseBrokerSymbol("  GBPUSDc ")).toMatchObject({ raw: "GBPUSDc", base: "GBPUSD", suffix: "c" });
  });
});

describe("normalizeBrokerSymbol", () => {
  it("preserves a valid lowercase suffix instead of uppercasing it away", () => {
    expect(normalizeBrokerSymbol("XAUUSDc")).toBe("XAUUSDc");
    expect(normalizeBrokerSymbol("EURUSDm")).toBe("EURUSDm");
  });

  it("uppercases plain symbols", () => {
    expect(normalizeBrokerSymbol("xauusd")).toBe("XAUUSD");
    expect(normalizeBrokerSymbol(" eurusd ")).toBe("EURUSD");
  });

  it("keeps the amplified-index marker's lowercase x", () => {
    expect(normalizeBrokerSymbol("us30_x10")).toBe("US30_x10");
    expect(normalizeBrokerSymbol("US30_X10")).toBe("US30_x10");
  });

  it("leaves free text alone apart from case", () => {
    expect(normalizeBrokerSymbol("eur/usd")).toBe("EUR/USD");
  });
});

describe("archiveSymbolFor", () => {
  it("uses the cent feed for a cent account even when the trade was typed without the suffix", () => {
    expect(archiveSymbolFor("XAUUSD", "cent")).toBe("XAUUSDc");
    expect(archiveSymbolFor("xauusd", "cent")).toBe("XAUUSDc");
  });

  it("is idempotent for an already-suffixed cent symbol", () => {
    expect(archiveSymbolFor("XAUUSDc", "cent")).toBe("XAUUSDc");
  });

  it("moves a stray Standard 'm' symbol on a cent account to the cent feed", () => {
    expect(archiveSymbolFor("EURUSDm", "cent")).toBe("EURUSDc");
  });

  it("returns the (normalized) instrument unchanged for standard accounts and when no type is known", () => {
    expect(archiveSymbolFor("XAUUSD", "standard")).toBe("XAUUSD");
    expect(archiveSymbolFor("xauusd")).toBe("XAUUSD");
    expect(archiveSymbolFor("XAUUSDc")).toBe("XAUUSDc"); // e.g. a backtest feed typed as a cent symbol
  });

  it("never appends a suffix to free text that can't be an archive symbol", () => {
    expect(archiveSymbolFor("EUR/USD", "cent")).toBe("EUR/USD");
  });
});

describe("archiveCandidates", () => {
  it("tries the plain symbol then the Standard 'm' form", () => {
    expect(archiveCandidates("EURUSD")).toEqual(["EURUSD", "EURUSDm"]);
  });

  it("names an already-suffixed feed exactly — no nonsense 'cm'/'mm' fallback", () => {
    expect(archiveCandidates("XAUUSDc")).toEqual(["XAUUSDc"]);
    expect(archiveCandidates("XAUUSDm")).toEqual(["XAUUSDm"]);
  });
});

describe("baseSymbol", () => {
  it("strips the account-type suffix", () => {
    expect(baseSymbol("USTECc")).toBe("USTEC");
    expect(baseSymbol("USTEC")).toBe("USTEC");
  });
});
