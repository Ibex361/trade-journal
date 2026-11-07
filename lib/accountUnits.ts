// The unit model for journal accounts — the ONE place that knows what a
// "cent" account means numerically, so no other file hard-codes 0.01 or
// 100.
//
// An Exness Standard Cent account differs from a Standard account in two
// independent ways:
//
//   1. LOT SIZE — one cent lot is 1/100 of a standard lot
//      (1,000 units of a forex pair's base currency instead of 100,000).
//   2. MONEY UNIT — balance and profit are denominated in US cents (USC):
//      $1 = 100 USC.
//
// Verified against a real cent-account order history (forex, gold and an
// index; every P&L reproduced to within 0.1 USC):
//
//     P&L (USC) = price move x lots x STANDARD contract size
//               = price move x units x 100,  where units = lots x std x 0.01
//
// Storage convention in this app (native-unit storage):
//   - trades.size            true units of the underlying (lots x std x 0.01)
//   - trades.pnl, balances,  the account's own unit (USC for a cent
//     targets                account), exactly as the broker reports them
//   - price fields           plain prices, unaffected
//
// Cent and Standard accounts must be separate journal accounts — the money
// scale differs by 100x, so mixing them in one account would silently
// corrupt every total.

export type AccountType = "standard" | "cent";

export const ACCOUNT_TYPES: readonly AccountType[] = ["standard", "cent"];

/** One cent lot is this fraction of a standard lot. */
export const CENT_LOT_FACTOR = 0.01;

/** Minor units per major unit: $1 = 100 USC. */
export const CENT_MONEY_SCALE = 100;

export type UnitModel = {
  accountType: AccountType;
  isCent: boolean;
  /** Multiplier from a standard-lot contract size to this account's units-per-lot. */
  lotFactor: number;
  /** Multiplier from (price move x units) in major currency to the account's own unit. */
  moneyScale: number;
};

const STANDARD_MODEL: UnitModel = { accountType: "standard", isCent: false, lotFactor: 1, moneyScale: 1 };
const CENT_MODEL: UnitModel = { accountType: "cent", isCent: true, lotFactor: CENT_LOT_FACTOR, moneyScale: CENT_MONEY_SCALE };

export function isAccountType(value: unknown): value is AccountType {
  return value === "standard" || value === "cent";
}

/** Anything unrecognized (including a missing column on an old row) is Standard. */
export function accountTypeOf(account?: { account_type?: string | null } | null): AccountType {
  return account && account.account_type === "cent" ? "cent" : "standard";
}

export function unitModel(account?: { account_type?: string | null } | null): UnitModel {
  return accountTypeOf(account) === "cent" ? CENT_MODEL : STANDARD_MODEL;
}

export function unitModelFor(type: AccountType): UnitModel {
  return type === "cent" ? CENT_MODEL : STANDARD_MODEL;
}

/** The currency label a new account of this type starts with. */
export function defaultCurrencyFor(type: AccountType): string {
  return type === "cent" ? "USC" : "USD";
}

export function accountTypeLabel(type: AccountType): string {
  return type === "cent" ? "Cent" : "Standard";
}

/** An amount in the account's own unit converted to major currency (USC -> USD). */
export function toMajorUnits(amount: number, model: UnitModel): number {
  return amount / model.moneyScale;
}

/**
 * "≈ $12.35" for a cent account, null for a Standard one (where the
 * amount is already in major units and a hint would be noise).
 */
export function formatMajorEquivalent(amount: number, model: UnitModel): string | null {
  if (!model.isCent) return null;
  const major = toMajorUnits(amount, model);
  const sign = major < 0 ? "-" : "";
  return `≈ ${sign}$${Math.abs(major).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
