// Exness instrument-symbol handling: suffix parsing, case-preserving
// normalization, and archive-symbol resolution.
//
// Exness marks the account type a symbol belongs to with a trailing,
// LOWERCASE letter (source: Exness "Tick history" page, which documents
// the archive's naming):
//
//   (none)  Pro accounts            XAUUSD
//   m       Standard accounts       XAUUSDm
//   c       Standard Cent accounts  XAUUSDc
//
// The suffix is case-significant and must never be uppercased away:
// the tick archive and this app's R2 candle keys are case-sensitive, and
// an uppercased "XAUUSDC" is a different (nonexistent) key from
// "XAUUSDc". It is also why suffix detection requires a lowercase letter
// after an all-uppercase base — plenty of real symbols legitimately end
// in an uppercase "C" (USTEC, ETHBTC) and must not be mistaken for cent
// symbols.
//
// Pure module: no I/O, no framework imports — shared by the browser app,
// the Node sync scripts and the tests.

import type { AccountType } from "./accountUnits";

export type SymbolSuffix = "" | "m" | "c";

export type BrokerSymbolParts = {
  /** The symbol as given, trimmed. */
  raw: string;
  /** The instrument without any account-type suffix, e.g. "XAUUSD". */
  base: string;
  /** The account-type suffix, or "" when there is none. */
  suffix: SymbolSuffix;
};

// An all-uppercase/digit base (optionally with Exness's amplified-index
// marker, e.g. US30_x10 — note that marker's lowercase "x" is part of the
// real symbol), followed by exactly one lowercase suffix letter.
const SUFFIXED_SYMBOL = /^([A-Z0-9]{3,}(?:_x\d+)?)([mc])$/;

/** Splits a broker symbol into its base instrument and account-type suffix. */
export function parseBrokerSymbol(symbol: string): BrokerSymbolParts {
  const raw = symbol.trim();
  const match = SUFFIXED_SYMBOL.exec(raw);
  if (!match) return { raw, base: raw, suffix: "" };
  return { raw, base: match[1], suffix: match[2] as "m" | "c" };
}

/**
 * Case-normalizes a user-typed or imported symbol WITHOUT destroying a
 * valid lowercase account-type suffix.
 *
 *   "xauusd"   -> "XAUUSD"
 *   "XAUUSDc"  -> "XAUUSDc"   (suffix preserved)
 *   "us30_x10" -> "US30_x10"  (amplified-index marker keeps its lowercase x)
 *
 * A fully lowercase "xauusdc" cannot be told apart from a plain symbol
 * that merely ends in C (e.g. "ustec"), so it is uppercased like any
 * other plain symbol — type the base in capitals and the suffix in
 * lowercase for cent symbols.
 */
export function normalizeBrokerSymbol(symbol: string): string {
  const trimmed = symbol.trim();
  const parts = parseBrokerSymbol(trimmed);
  if (parts.suffix) return trimmed;
  return trimmed.toUpperCase().replace(/_X(\d+)$/, "_x$1");
}

// A symbol shape the archive could plausibly contain — guards
// archiveSymbolFor against appending a suffix to free text such as
// "EUR/USD" typed into a manual trade.
const PLAUSIBLE_BASE = /^[A-Z0-9]{3,}(?:_x\d+)?$/;

/**
 * The tick-archive / R2 symbol to use for charting a journal instrument.
 *
 * A cent account's feed is the "c" feed even when the trade was typed in
 * by hand as plain "XAUUSD", so the account type — not just the text —
 * decides. For every other account the (case-normalized) instrument is
 * used as-is; the sync's candidate list (archiveCandidates) handles the
 * Standard "m" fallback.
 */
export function archiveSymbolFor(instrument: string, accountType?: AccountType): string {
  const normalized = normalizeBrokerSymbol(instrument);
  if (accountType !== "cent") return normalized;
  const { base } = parseBrokerSymbol(normalized);
  return PLAUSIBLE_BASE.test(base) ? `${base}c` : normalized;
}

/**
 * Archive symbol forms to try, in order, when fetching a symbol's ticks.
 * An already-suffixed symbol names its feed exactly; a plain one falls
 * back to the Standard-account ("m") form, since Exness names archive
 * instruments per the account type that traded them.
 */
export function archiveCandidates(archiveSymbol: string): string[] {
  const { suffix } = parseBrokerSymbol(archiveSymbol);
  return suffix ? [archiveSymbol] : [archiveSymbol, `${archiveSymbol}m`];
}

/** The base instrument, for grouping/classification regardless of account type. */
export function baseSymbol(symbol: string): string {
  return parseBrokerSymbol(symbol).base;
}
