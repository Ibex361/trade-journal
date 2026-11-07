import { describe, it, expect } from "vitest";
import { accountTypeOf, unitModel, unitModelFor, defaultCurrencyFor, toMajorUnits, formatMajorEquivalent, isAccountType } from "../accountUnits";

describe("account unit model", () => {
  it("defaults anything unrecognized — including a missing column — to Standard", () => {
    expect(accountTypeOf(undefined)).toBe("standard");
    expect(accountTypeOf(null)).toBe("standard");
    expect(accountTypeOf({})).toBe("standard");
    expect(accountTypeOf({ account_type: "weird" })).toBe("standard");
    expect(accountTypeOf({ account_type: "cent" })).toBe("cent");
  });

  it("Standard is the identity model", () => {
    expect(unitModel({ account_type: "standard" })).toMatchObject({ isCent: false, lotFactor: 1, moneyScale: 1 });
  });

  it("Cent is 1/100 lot and 100 USC per USD", () => {
    expect(unitModelFor("cent")).toMatchObject({ isCent: true, lotFactor: 0.01, moneyScale: 100 });
  });

  it("picks a sensible default currency label per type", () => {
    expect(defaultCurrencyFor("standard")).toBe("USD");
    expect(defaultCurrencyFor("cent")).toBe("USC");
  });

  it("validates account-type values", () => {
    expect(isAccountType("cent")).toBe(true);
    expect(isAccountType("standard")).toBe(true);
    expect(isAccountType("pro")).toBe(false);
    expect(isAccountType(undefined)).toBe(false);
  });

  it("converts cents to dollars and formats the hint only for cent accounts", () => {
    const cent = unitModelFor("cent");
    expect(toMajorUnits(1000, cent)).toBe(10);
    expect(formatMajorEquivalent(1000, cent)).toBe("≈ $10.00");
    expect(formatMajorEquivalent(-41.5, cent)).toBe("≈ -$0.42");
    expect(formatMajorEquivalent(1234567, cent)).toBe("≈ $12,345.67");
    expect(formatMajorEquivalent(1000, unitModelFor("standard"))).toBeNull();
  });
});
