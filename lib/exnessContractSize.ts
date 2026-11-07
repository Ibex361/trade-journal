// Maps an Exness instrument symbol to its contract size, i.e. how many
// units of the underlying one lot represents. Used to convert an imported
// trade's "lots" figure into the same "units" convention the rest of this
// app uses for the size field (see manual entry, and calculatePnl's
// size*priceDiff formula in lib/metrics/pnl.ts).
//
// Account types (see lib/brokerSymbol.ts for the suffix convention):
//   - Standard / Pro: one lot = the instrument's standard contract size.
//   - Standard Cent (symbols suffixed "c", or any symbol on an account
//     whose type is "cent"): one cent lot = 1/100 of a standard lot, so
//     the units-per-lot is the standard contract size x 0.01. This holds
//     for every instrument — forex 100,000 -> 1,000, gold 100 oz -> 1 oz,
//     indices 1 -> 0.01 — and was verified against real cent-account
//     profit figures (see lib/accountUnits.ts).
//   The "m" suffix (Standard accounts) is not a size modifier at all and
//   is simply ignored here.
//
// Source: Exness' published contract specifications (get.exness.help:
// instrument pages and the "Common trading terms" glossary), checked
// 2026-11-07. Re-check this table if Exness changes specs or adds
// instruments — it isn't fetched live.
//
// Coverage note: this is not exhaustive. Anything not matched falls back
// to a contract size of 1 (see contractSizeFor below) — and the import
// reports every such symbol as a warning (hasKnownContractSize) so a
// guessed size never goes by silently. A per-account override (Settings →
// Broker import) always wins.

import { parseBrokerSymbol } from "./brokerSymbol";
import { CENT_LOT_FACTOR, type AccountType } from "./accountUnits";

// Exact symbol -> contract size. Checked first, before any pattern rule,
// since a handful of instruments break their family's usual pattern
// (index "amplified" variants, ETHBTC, DXY, per-coin crypto sizes).
const EXACT_CONTRACT_SIZES: Record<string, number> = {
  // Forex - most pairs are 100,000, but DXY is the one standard exception.
  DXY: 1000,

  // Indices - published contract size is 1 for the base symbol on nearly
  // every major index; the "_x10"/"_x100" amplified variants are distinct
  // symbols with their own larger contract size. Keys are uppercase since
  // lookups are normalized to uppercase (see contractSizeFor below).
  US30_X10: 10,
  USTEC_X100: 100,
  US500_X100: 100,

  // Energies (Exness "Common trading terms"): oil is 1,000 barrels per
  // lot, natural gas 10,000 MMBtu. XNGUSD is listed here, before the
  // six-letter forex pattern, which would otherwise misread it as a
  // currency pair.
  USOIL: 1000,
  UKOIL: 1000,
  XNGUSD: 10000,

  // Crypto - contract size is defined per coin, not a flat multiplier.
  // Cent variants (BTCUSDc, ETHUSDc, ...) are derived from these by the
  // cent lot factor in contractSizeFor, so they need no entries of their own.
  BTCUSD: 1,
  BTCJPY: 1,
  BTCUSDT: 1,
  ETHUSD: 1,
  ETHBTC: 100,
  // Bitcoin cross-pairs (BTCXAU, BTCXAG, BTCTHB, BTCAUD, BTCCNH, BTCZAR)
  // are all 1 BTC — covered by the BTC pattern rule below instead of
  // being repeated here.
};

// Pattern rules, checked in order, for symbol families not covered above.
// Each is (test, contractSize).
const PATTERN_RULES: Array<{ test: (symbol: string) => boolean; size: number }> = [
  // Metals (Exness "Common trading terms"): gold-family pairs (XAUUSD,
  // XAUAUD, XAUEUR, ...) are 100 troy oz, silver (XAGUSD, XAGAUD, ...) is
  // 5,000 troy oz, platinum and palladium (XPT*, XPD*) are 100 troy oz.
  { test: (s) => /^XAU[A-Z]{3}$/.test(s), size: 100 },
  { test: (s) => /^XAG[A-Z]{3}$/.test(s), size: 5000 },
  { test: (s) => /^X(PT|PD)[A-Z]{3}$/.test(s), size: 100 },

  // Indices: one contract per index point (size 1). US30, USTEC and US500
  // are confirmed on Exness' Indices help page; the other majors follow
  // the same convention. The amplified "_x10"/"_x100" variants are exact
  // entries above and are never matched here.
  { test: (s) => /^(US30|US100|US500|USTEC|SPX500|DE30|GER30|GER40|UK100|JP225|JPN225|AUS200|FR40|FRA40|STOXX50|HK50)$/.test(s), size: 1 },

  // Stocks: Exness stock CFDs use a 100-share contract size. Symbols are
  // typically plain tickers (AAPL, TSLA, JD, ...) with no fixed pattern to
  // key off, so this only catches the small set of tickers explicitly
  // named in Exness' stocks help page as MT5-only (a weak but non-zero
  // signal); most stock tickers will fall through to the default.
  {
    test: (s) => /^(JD|BIDU|PDD|BILI|BEKE|ZTO|TAL|YUMC|FTNT|EDU|LI|XPEV|NIO|TME|NTES|TSM|VIPS|FUTU)$/.test(s),
    size: 100,
  },

  // Bitcoin cross-pairs: 1 BTC contract size, same as BTCUSD.
  { test: (s) => /^BTC(XAU|XAG|THB|AUD|CNH|ZAR)$/.test(s), size: 1 },

  // Forex: six-letter currency pairs (EURUSD, GBPJPY, ...) are 100,000.
  // Checked last among patterns. Excludes XAU (handled above) and the
  // other metal prefixes (XAG/XPT/XPD) this table doesn't have confirmed
  // specs for yet - those fall through to the size-1 default rather than
  // being misidentified as forex.
  { test: (s) => /^[A-Z]{6}$/.test(s) && !/^X(AU|AG|PT|PD)/.test(s), size: 100000 },
];

/** Standard-lot contract size for an uppercased BASE symbol, or null when it isn't in the table. */
function lookupStandardSize(baseUpper: string): number | null {
  if (baseUpper in EXACT_CONTRACT_SIZES) return EXACT_CONTRACT_SIZES[baseUpper];
  for (const rule of PATTERN_RULES) {
    if (rule.test(baseUpper)) return rule.size;
  }
  return null;
}

/** Strips floating-point noise (3 * 0.01 = 0.03 exactly, not 0.030000000000000002). */
function clean(n: number): number {
  return Math.round(n * 1e9) / 1e9;
}

/**
 * Returns the contract size (units per lot) for an Exness symbol.
 *
 * - `accountType` "cent" treats the symbol as a cent-account symbol even
 *   if it was typed without its "c" suffix; a "c"-suffixed symbol is
 *   cent regardless of the hint.
 * - If `overrides` (symbol -> size, e.g. from fetchContractSizeOverrides)
 *   has an entry for this symbol (or, failing that, its suffix-free
 *   base), that value wins over everything below and is used AS-IS — an
 *   override is the final units-per-lot on that account, no cent factor
 *   applied on top. Overrides are account-scoped and accounts are
 *   single-type, so this can't leak between Standard and Cent.
 * - Otherwise the standard-lot size comes from the exact table, then the
 *   pattern rules, then a default of 1 (a safe no-op multiplier rather
 *   than a guess); cent accounts scale that by CENT_LOT_FACTOR.
 */
export function contractSizeFor(symbol: string, overrides?: Map<string, number>, accountType?: AccountType): number {
  const parts = parseBrokerSymbol(symbol);
  const rawUpper = parts.raw.toUpperCase();
  const baseUpper = parts.base.toUpperCase();

  if (overrides?.has(rawUpper)) return overrides.get(rawUpper)!;
  if (parts.suffix && overrides?.has(baseUpper)) return overrides.get(baseUpper)!;

  const standard = lookupStandardSize(baseUpper) ?? 1;
  const isCent = parts.suffix === "c" || accountType === "cent";
  return isCent ? clean(standard * CENT_LOT_FACTOR) : standard;
}

/**
 * Whether the size contractSizeFor returns for this symbol comes from a
 * real spec (the built-in table or a user override) rather than the
 * size-1 fallback. The importer uses it to warn about symbols whose
 * lot-to-unit conversion is a placeholder.
 */
export function hasKnownContractSize(symbol: string, overrides?: Map<string, number>): boolean {
  const parts = parseBrokerSymbol(symbol);
  const baseUpper = parts.base.toUpperCase();
  if (overrides?.has(parts.raw.toUpperCase()) || overrides?.has(baseUpper)) return true;
  return lookupStandardSize(baseUpper) !== null;
}
