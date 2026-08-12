// Maps this app's instrument symbols (Exness-style, e.g. "XAUUSD",
// "EURUSD", "US30", "BTCUSD" — see exnessContractSize.ts for the same
// symbol convention) to the symbol format Twelve Data's API expects
// (e.g. "XAU/USD", "EUR/USD", "BTC/USD"). Twelve Data has no single
// consistent convention across asset classes: forex/metals/crypto use a
// slash pair, indices use provider-specific plain tickers that don't
// follow any derivable pattern from the Exness symbol — so indices are
// listed explicitly rather than pattern-matched.
//
// Coverage note: this is not exhaustive, same philosophy as
// exnessContractSize.ts — it covers the instrument families a retail
// trader is most likely to log (majors, gold/silver, the big US/EU/Asia
// indices, the most-traded crypto pairs). Anything not matched here (and
// not covered by a user override — see chartSymbolOverrides.ts) returns
// null, and the caller shows "no chart mapping for this symbol yet"
// rather than guessing wrong and fetching silently-incorrect data.
//
// Twelve Data's own index coverage varies by plan (some indices need a
// paid tier) — see TradeChartModal's error handling for how a
// plan-restricted symbol is surfaced. This table only maps the symbol;
// it can't promise the free tier can fetch it.

export type ChartAssetKind = "forex" | "metal" | "index" | "crypto";

export type ChartSymbolMapping = {
  /** The symbol string to send to Twelve Data's time_series endpoint. */
  twelveDataSymbol: string;
  kind: ChartAssetKind;
};

// Exact symbol -> Twelve Data symbol. Checked first, before any pattern
// rule — indices in particular have no derivable pattern from the Exness
// symbol, so every index this app expects to chart is listed by hand.
// Keys are uppercase since lookups are normalized to uppercase (see
// resolveChartSymbol below).
const EXACT_SYMBOL_MAP: Record<string, ChartSymbolMapping> = {
  // Major US / EU / Asia indices — Exness symbol -> Twelve Data ticker.
  US30: { twelveDataSymbol: "DJI", kind: "index" },
  US500: { twelveDataSymbol: "SPX", kind: "index" },
  USTEC: { twelveDataSymbol: "NDX", kind: "index" },
  UK100: { twelveDataSymbol: "UK100", kind: "index" },
  GER40: { twelveDataSymbol: "DAX", kind: "index" },
  GER30: { twelveDataSymbol: "DAX", kind: "index" },
  FRA40: { twelveDataSymbol: "FCHI", kind: "index" },
  JPN225: { twelveDataSymbol: "JP225", kind: "index" },
  AUS200: { twelveDataSymbol: "AS51", kind: "index" },
  US2000: { twelveDataSymbol: "RUT", kind: "index" },

  // DXY is a forex-family instrument at Exness but its own index-style
  // ticker at Twelve Data, not a slash pair.
  DXY: { twelveDataSymbol: "DXY", kind: "index" },

  // Metals — 3-letter-vs-3-letter pairs already look like forex, but are
  // kept as an explicit table (not the forex pattern rule below) since
  // XAG/XPT/XPD aren't guaranteed to exist as Twelve Data pairs the same
  // way every currency cross does.
  XAUUSD: { twelveDataSymbol: "XAU/USD", kind: "metal" },
  XAGUSD: { twelveDataSymbol: "XAG/USD", kind: "metal" },
  XPTUSD: { twelveDataSymbol: "XPT/USD", kind: "metal" },
  XPDUSD: { twelveDataSymbol: "XPD/USD", kind: "metal" },

  // Crypto — Twelve Data uses BTC/USD, not BTCUSD. Cent/micro variants
  // (BTCUSDc) and stablecoin pairs (BTCUSDT) chart against the same
  // underlying market data as their plain counterpart.
  BTCUSD: { twelveDataSymbol: "BTC/USD", kind: "crypto" },
  BTCUSDT: { twelveDataSymbol: "BTC/USD", kind: "crypto" },
  ETHUSD: { twelveDataSymbol: "ETH/USD", kind: "crypto" },
  ETHUSDT: { twelveDataSymbol: "ETH/USD", kind: "crypto" },
  ETHBTC: { twelveDataSymbol: "ETH/BTC", kind: "crypto" },
  XRPUSD: { twelveDataSymbol: "XRP/USD", kind: "crypto" },
  LTCUSD: { twelveDataSymbol: "LTC/USD", kind: "crypto" },
  SOLUSD: { twelveDataSymbol: "SOL/USD", kind: "crypto" },
  BNBUSD: { twelveDataSymbol: "BNB/USD", kind: "crypto" },
  ADAUSD: { twelveDataSymbol: "ADA/USD", kind: "crypto" },
  DOGEUSD: { twelveDataSymbol: "DOGE/USD", kind: "crypto" },
};

// A cent/micro-account suffix ("c"/"C") can appear on an otherwise-plain
// symbol (e.g. "XAUUSDc", "BTCUSDc"). Only stripped as a fallback, after
// the un-stripped symbol has already been checked against the exact
// table — some legitimate symbols end in "C" on their own (USTEC,
// ETHBTC), so blindly stripping every trailing "C" before the lookup
// would corrupt those into "USTE"/"ETHBT" and miss them entirely.
// Mirrors cleanSymbol()'s trailing-"m" strip in exnessImport.ts, but for
// the trailing "c" that strip deliberately leaves alone (see that file's
// contract-size comments on why "c" is kept for size lookups — chart
// data doesn't care about lot size, so it's safe to strip here once the
// plain symbol has had first shot at matching).
function stripCentSuffix(symbol: string): string {
  return symbol.replace(/C$/, "");
}

/**
 * Resolves an app instrument symbol to a Twelve Data symbol + asset kind,
 * or null if nothing matches. If `overrides` is given (an uppercased
 * symbol -> Twelve Data symbol map — see chartSymbolOverrides.ts) and it
 * has an entry for this symbol, that value always wins, same priority
 * order as contractSizeFor's overrides in exnessContractSize.ts. The
 * override's asset kind is inferred from its own format (a "/" means a
 * forex/metal/crypto-style pair; otherwise it's treated as an index-style
 * plain ticker) since an override doesn't record a kind explicitly.
 */
export function resolveChartSymbol(
  symbol: string,
  overrides?: Map<string, string>
): ChartSymbolMapping | null {
  const raw = symbol.trim().toUpperCase();
  if (!raw) return null;

  if (overrides?.has(raw)) {
    const mapped = overrides.get(raw)!;
    return { twelveDataSymbol: mapped, kind: mapped.includes("/") ? "forex" : "index" };
  }

  // The plain (un-stripped) symbol gets first shot at the exact table —
  // this is what lets USTEC/ETHBTC (which end in "C" on their own) match
  // directly rather than being corrupted by the cent-suffix strip below.
  if (raw in EXACT_SYMBOL_MAP) return EXACT_SYMBOL_MAP[raw];

  const cleaned = stripCentSuffix(raw);
  if (cleaned !== raw && cleaned in EXACT_SYMBOL_MAP) return EXACT_SYMBOL_MAP[cleaned];

  // Forex: six-letter currency pairs (EURUSD, GBPJPY, ...) become
  // "EUR/USD" — checked last, against the cent-stripped form, and
  // excludes anything already claimed by the exact table above (metals
  // happen to also be six letters).
  if (/^[A-Z]{6}$/.test(cleaned)) {
    return { twelveDataSymbol: `${cleaned.slice(0, 3)}/${cleaned.slice(3)}`, kind: "forex" };
  }

  return null;
}
