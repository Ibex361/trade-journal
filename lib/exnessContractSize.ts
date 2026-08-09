// Maps an Exness instrument symbol (already cleaned of the Standard Cent
// "m" suffix — see cleanSymbol in exnessImport.ts) to its contract size,
// i.e. how many units of the underlying one lot represents. Used to convert
// an imported trade's "lots" figure into the same "units" convention the
// rest of this app uses for the size field (see manual entry, and
// calculatePnl's size*priceDiff formula in lib/metrics/pnl.ts).
//
// Source: Exness' published contract specifications (get.exness.help),
// current as of Aug 2026. Re-check this table if Exness changes specs or
// adds new instruments — it isn't fetched live.
//
// Coverage note: this is not exhaustive. It covers the instrument families
// a retail trader is most likely to see in a trade history export. Anything
// not matched falls back to a contract size of 1 (see contractSizeFor
// below) — a safe default since it's already correct for most indices,
// and for anything else it just reproduces today's raw-lots behavior
// rather than silently multiplying by a guessed number.

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

  // Crypto - contract size is defined per coin, not a flat multiplier.
  // Standard Cent variants (suffixed "c"/"C") use a smaller size; note
  // that cleanSymbol() in exnessImport.ts strips a trailing lowercase "m"
  // but not "c", so BTCUSDc reaches this table as-is (matched here as
  // BTCUSDC since lookups are uppercased - see contractSizeFor below).
  BTCUSD: 1,
  BTCUSDC: 0.01,
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
  // Metals: gold-family pairs (XAUUSD, XAUAUD, XAUEUR, XAUGBP, ...) are all
  // 100 troy oz. Silver/platinum/palladium have their own specs this table
  // doesn't cover yet - they fall through to the size-1 default below
  // rather than risk a wrong guess.
  { test: (s) => /^XAU[A-Z]{3}$/.test(s), size: 100 },

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

/**
 * Returns the contract size (units per lot) for a cleaned Exness symbol.
 * If `overrides` is given (a symbol -> size map, e.g. from
 * fetchContractSizeOverrides in exnessContractOverrides.ts) and it has an
 * entry for this symbol, that value wins over everything below — user
 * overrides always take priority over the built-in table. Otherwise falls
 * back through the exact-symbol table, then the pattern rules, then a
 * default of 1 — correct for most indices, and a safe no-op multiplier for
 * anything else, rather than guessing.
 */
export function contractSizeFor(symbol: string, overrides?: Map<string, number>): number {
  const s = symbol.toUpperCase();
  if (overrides?.has(s)) return overrides.get(s)!;
  if (s in EXACT_CONTRACT_SIZES) return EXACT_CONTRACT_SIZES[s];
  for (const rule of PATTERN_RULES) {
    if (rule.test(s)) return rule.size;
  }
  return 1;
}
