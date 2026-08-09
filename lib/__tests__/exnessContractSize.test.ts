import { describe, it, expect } from "vitest";
import { contractSizeFor } from "../exnessContractSize";

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
    expect(contractSizeFor("XPTUSD")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(contractSizeFor("eurusd")).toBe(100000);
  });

  it("prefers a user override over the built-in table for a known symbol", () => {
    const overrides = new Map([["EURUSD", 12345]]);
    expect(contractSizeFor("EURUSD", overrides)).toBe(12345);
  });

  it("prefers a user override over the size-1 fallback for an unknown symbol", () => {
    const overrides = new Map([["XPTUSD", 100]]);
    expect(contractSizeFor("XPTUSD", overrides)).toBe(100);
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
