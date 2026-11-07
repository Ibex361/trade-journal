import { describe, it, expect } from "vitest";
import { contractSizeFor, hasKnownContractSize } from "../exnessContractSize";

describe("contractSizeFor", () => {
  it("returns 100,000 for standard six-letter forex pairs", () => {
    expect(contractSizeFor("EURUSD")).toBe(100000);
    expect(contractSizeFor("GBPJPY")).toBe(100000);
  });

  it("returns 1,000 for DXY specifically, overriding the forex pattern", () => {
    expect(contractSizeFor("DXY")).toBe(1000);
  });

  it("returns 100 troy oz for gold-family metal pairs", () => {
    expect(contractSizeFor("XAUUSD")).toBe(100);
    expect(contractSizeFor("XAUEUR")).toBe(100);
    expect(contractSizeFor("XAUGBP")).toBe(100);
  });

  it("returns 1 for standard index symbols", () => {
    expect(contractSizeFor("US30")).toBe(1);
    expect(contractSizeFor("USTEC")).toBe(1);
    expect(contractSizeFor("US500")).toBe(1);
    expect(contractSizeFor("UK100")).toBe(1);
  });

  it("returns the amplified contract size for indexed x10/x100 variants", () => {
    expect(contractSizeFor("US30_x10")).toBe(10);
    expect(contractSizeFor("USTEC_x100")).toBe(100);
    expect(contractSizeFor("US500_x100")).toBe(100);
  });

  it("returns correct per-coin contract sizes for crypto", () => {
    expect(contractSizeFor("BTCUSD")).toBe(1);
    expect(contractSizeFor("ETHUSD")).toBe(1);
    expect(contractSizeFor("ETHBTC")).toBe(100);
  });

  it("returns the Standard Cent contract size for the c-suffixed BTC pair", () => {
    expect(contractSizeFor("BTCUSDc")).toBe(0.01);
  });

  it("returns 1 BTC for bitcoin cross-pairs", () => {
    expect(contractSizeFor("BTCXAU")).toBe(1);
    expect(contractSizeFor("BTCZAR")).toBe(1);
  });

  it("returns 100 shares for known MT5-only stock tickers", () => {
    expect(contractSizeFor("TSM")).toBe(100);
  });

  it("falls back to 1 for unrecognized symbols", () => {
    expect(contractSizeFor("SOMETHING_WEIRD")).toBe(1);
    expect(contractSizeFor("ZZZZ")).toBe(1);
  });

  it("returns the published sizes for silver, platinum and palladium", () => {
    expect(contractSizeFor("XAGUSD")).toBe(5000);
    expect(contractSizeFor("XAGAUD")).toBe(5000);
    expect(contractSizeFor("XPTUSD")).toBe(100);
    expect(contractSizeFor("XPDUSD")).toBe(100);
  });

  it("returns the published sizes for energies, ahead of the six-letter forex rule", () => {
    expect(contractSizeFor("USOIL")).toBe(1000);
    expect(contractSizeFor("UKOIL")).toBe(1000);
    expect(contractSizeFor("XNGUSD")).toBe(10000); // would be misread as forex (100,000) otherwise
  });

  it("is case-insensitive", () => {
    expect(contractSizeFor("eurusd")).toBe(100000);
  });

  it("prefers a user override over the built-in table for a known symbol", () => {
    const overrides = new Map([["EURUSD", 12345]]);
    expect(contractSizeFor("EURUSD", overrides)).toBe(12345);
  });

  it("prefers a user override over the size-1 fallback for an unknown symbol", () => {
    const overrides = new Map([["ZZZZ", 250]]);
    expect(contractSizeFor("ZZZZ", overrides)).toBe(250);
  });

  it("falls through to the built-in table when overrides don't cover this symbol", () => {
    const overrides = new Map([["EURUSD", 12345]]);
    expect(contractSizeFor("GBPUSD", overrides)).toBe(100000);
  });

  it("matches overrides case-insensitively, same as the built-in table", () => {
    const overrides = new Map([["EURUSD", 500]]);
    expect(contractSizeFor("eurusd", overrides)).toBe(500);
  });

  it("behaves exactly as before when no overrides map is passed", () => {
    expect(contractSizeFor("EURUSD")).toBe(100000);
    expect(contractSizeFor("SOMETHING_WEIRD")).toBe(1);
  });
});

describe("contractSizeFor — cent accounts", () => {
  it("scales every instrument family by 1/100 for c-suffixed symbols", () => {
    expect(contractSizeFor("GBPUSDc")).toBe(1000); // forex 100,000 -> 1,000
    expect(contractSizeFor("XAUUSDc")).toBe(1); // gold 100 oz -> 1 oz
    expect(contractSizeFor("USTECc")).toBe(0.01); // index 1 -> 0.01
    expect(contractSizeFor("XAGUSDc")).toBe(50); // silver 5,000 -> 50
    expect(contractSizeFor("BTCUSDc")).toBe(0.01); // crypto 1 -> 0.01
  });

  it("does not misread USTECc as a six-letter forex pair", () => {
    // Regression: the suffixed symbol is 6 letters long and used to hit the forex rule (100,000).
    expect(contractSizeFor("USTECc")).not.toBe(100000);
    expect(contractSizeFor("USTEC")).toBe(1);
  });

  it("treats plain symbols as cent when the account type says so", () => {
    expect(contractSizeFor("EURUSD", undefined, "cent")).toBe(1000);
    expect(contractSizeFor("EURUSD", undefined, "standard")).toBe(100000);
    expect(contractSizeFor("EURUSD")).toBe(100000);
  });

  it("is not double-scaled when both the suffix and the account type say cent", () => {
    expect(contractSizeFor("EURUSDc", undefined, "cent")).toBe(1000);
  });

  it("ignores the Standard 'm' suffix for sizing", () => {
    expect(contractSizeFor("EURUSDm")).toBe(100000);
    expect(contractSizeFor("XAUUSDm")).toBe(100);
  });

  it("uses an override as the final units-per-lot, with no cent factor applied on top", () => {
    expect(contractSizeFor("XAUUSDc", new Map([["XAUUSDC", 7]]))).toBe(7);
    expect(contractSizeFor("XAUUSDc", new Map([["XAUUSD", 7]]))).toBe(7); // base-level override also honored
    expect(contractSizeFor("XAUUSD", new Map([["XAUUSD", 7]]), "cent")).toBe(7);
  });

  it("scales amplified-index variants too", () => {
    expect(contractSizeFor("USTEC_x100c")).toBe(1);
  });
});

describe("hasKnownContractSize", () => {
  it("is true for table and pattern matches, including cent-suffixed ones", () => {
    expect(hasKnownContractSize("EURUSD")).toBe(true);
    expect(hasKnownContractSize("USTECc")).toBe(true);
    expect(hasKnownContractSize("XAGUSDc")).toBe(true);
    expect(hasKnownContractSize("USOIL")).toBe(true);
  });

  it("is false for symbols that would fall back to the placeholder size 1", () => {
    expect(hasKnownContractSize("SOMETHING_WEIRD")).toBe(false);
    expect(hasKnownContractSize("ZZZZc")).toBe(false);
  });

  it("is true when an override covers the symbol", () => {
    expect(hasKnownContractSize("ZZZZ", new Map([["ZZZZ", 5]]))).toBe(true);
  });
});
