import { TradeInput, ExitReason } from "./trades";
import { parseCsvRows, parseNumber, ImportRowIssue, ParsedImport } from "./csvUtils";
import { calculateRMultiple } from "./metrics";
import { contractSizeFor, hasKnownContractSize } from "./exnessContractSize";
import { parseBrokerSymbol } from "./brokerSymbol";
import { type AccountType } from "./accountUnits";

// Exness exports opening_time_utc in UTC. This journal logs everything in
// East Africa Time (UTC+3), the user's local time, so imported timestamps
// are shifted forward by this many hours before being split back into a
// calendar date + clock time. A row near UTC midnight can therefore land
// on the following local calendar date.
const EXNESS_TO_LOCAL_OFFSET_HOURS = 3;

/**
 * Converts an Exness opening_time_utc date/time pair (already split on "T")
 * into the app's local (UTC+3) date + time. Falls back to the original,
 * unshifted date (and no time) if the timestamp can't be parsed or has no
 * clock time to shift.
 */
function toLocalDateTime(
  datePart: string,
  timePart: string | undefined
): { date: string | null; time: string | null } {
  const rawTime = timePart && /^\d{2}:\d{2}(:\d{2})?/.test(timePart) ? timePart.slice(0, 8) : null;
  if (!rawTime) {
    return { date: datePart, time: null };
  }

  const isoTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const utcDate = new Date(`${datePart}T${isoTime}Z`);
  if (Number.isNaN(utcDate.getTime())) {
    return { date: datePart, time: rawTime };
  }

  const shifted = new Date(utcDate.getTime() + EXNESS_TO_LOCAL_OFFSET_HOURS * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  const ss = String(shifted.getUTCSeconds()).padStart(2, "0");
  return { date: `${y}-${m}-${d}`, time: `${hh}:${mm}:${ss}` };
}

export type { ImportRowIssue, ParsedImport } from "./csvUtils";

// Columns this parser actually needs to recognize the file and build a
// trade. Exness' export has more columns than this (original_position_size,
// equity, margin_level) that this app has no field for, so they're read
// from the row when useful and otherwise left alone.
const REQUIRED_HEADERS = ["ticket", "opening_time_utc", "symbol", "type", "profit"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Exness suffixes symbols with a lowercase letter that names the account
// type they belong to (see lib/brokerSymbol.ts): "m" for Standard accounts
// (XAUUSDm, EURUSDm) and "c" for Standard Cent accounts (XAUUSDc). For a
// Standard account the "m" isn't part of the instrument name, so it's
// stripped to match what you'd type by hand. For a Cent account the
// symbol is kept exactly as exported: the "c" is part of the feed's
// identity (the tick archive and chart data are keyed by it) and is what
// tells the rest of the app how to size and chart the trade.
function instrumentFor(symbolRaw: string, accountType: AccountType): string {
  if (accountType === "cent") return symbolRaw;
  const parts = parseBrokerSymbol(symbolRaw);
  return parts.suffix === "m" ? parts.base : symbolRaw;
}

// Best-effort category guess from the symbol's BASE (so a cent "GBPUSDc"
// classifies exactly like "GBPUSD"), purely to save re-typing it for
// every row — left null (and easy to edit per-trade afterward) for
// anything not confidently recognized.
function guessAssetClass(symbol: string): string | null {
  const s = parseBrokerSymbol(symbol).base.toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return "Metals";
  if (/(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|BNB|DOT|AVAX)/.test(s)) return "Crypto";
  if (/^(US30|US100|US500|USTEC|SPX500|DE30|GER30|GER40|UK100|JP225|JPN225|AUS200|FR40|FRA40|STOXX50|HK50)/.test(s)) return "Indices";
  // Energies: the three Exness lists as energy contracts (USOIL/UKOIL, XNGUSD).
  if (/^(USOIL|UKOIL|XNGUSD)$/.test(s)) return "Energies";
  if (/^[A-Z]{6}$/.test(s)) return "Forex";
  return null;
}

function closeReasonToExitReason(reason: string): ExitReason | null {
  switch (reason.trim().toLowerCase()) {
    case "sl":
      return "stop_loss";
    case "tp":
      return "take_profit";
    case "user":
      return "manual";
    default:
      return null;
  }
}

/**
 * Parses an Exness "trade history" CSV export into TradeInput rows.
 *
 * A few things this deliberately does that a straight column copy wouldn't:
 * - P&L is profit + commission + swap (Exness reports these separately;
 *   a journal entry needs the actual net result).
 * - Times come in as opening_time_utc / closing_time_utc — both are kept,
 *   as entry_date/entry_time and exit_date/exit_time respectively. Exness
 *   reports them in UTC; both are shifted to East Africa Time (UTC+3)
 *   before being split into date/time, since that's the timezone this
 *   journal logs in everywhere else.
 * - r_multiple is auto-calculated the same way the manual trade form does
 *   (reward ÷ risk, from entry/exit/stop-loss), so imported trades get an
 *   R multiple whenever a stop_loss value is present in the export.
 * - Each row's broker "ticket" is kept as broker_ticket, so a re-import of
 *   an overlapping date range can be de-duplicated by the caller instead
 *   of creating repeat trades.
 * - size is converted from Exness "lots" into the same units convention
 *   the manual trade form uses (lots × contract size — e.g. 0.01 lots of
 *   an instrument with a 100,000 contract size becomes 1000), via
 *   contractSizeFor() in exnessContractSize.ts, so the size field reads
 *   consistently whether a trade was imported or logged by hand. This is
 *   cosmetic only — pnl above is always the broker-reported net result,
 *   never derived from size, so this conversion can't affect P&L. The
 *   optional `overrides` param lets a caller pass this account's saved
 *   contract-size overrides (fetchContractSizeOverrides in
 *   exnessContractOverrides.ts) — set in the "Broker import" settings
 *   card — which take priority over the built-in table per symbol.
 * - take_profit is kept as take_profit_price. equity and margin_level
 *   still have no matching field in this app and are dropped rather than
 *   stuffed somewhere they don't belong.
 * - close_reason maps to the structured exit_reason field (sl → stop_loss,
 *   tp → take_profit, user → manual) rather than being written into notes
 *   as prose. sl_movement/tp_movement are left unset — Exness doesn't
 *   report whether a stop or target was moved during the trade.
 */
export function parseExnessCsv(
  csvText: string,
  overrides?: Map<string, number>,
  options?: { accountType?: AccountType }
): ParsedImport {
  const accountType: AccountType = options?.accountType ?? "standard";
  // Tallies for the post-parse warnings below.
  let centSymbolRows = 0;
  let plainSymbolRows = 0;
  const unknownSizeSymbols = new Set<string>();

  const rows = parseCsvRows(csvText).filter((r) => !(r.length === 1 && r[0].trim() === ""));
  const issues: ImportRowIssue[] = [];
  const trades: TradeInput[] = [];

  if (rows.length === 0) {
    return { trades, issues: [{ row: 0, message: "The file is empty." }] };
  }

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const colIndex = new Map<string, number>();
  header.forEach((label, i) => colIndex.set(label, i));

  const missing = REQUIRED_HEADERS.filter((h) => !colIndex.has(h));
  if (missing.length > 0) {
    return {
      trades,
      issues: [
        {
          row: 0,
          message:
            "This doesn't look like an Exness trade history export — expected columns such as ticket, opening_time_utc, symbol, type, and profit.",
        },
      ],
    };
  }

  const cell = (cells: string[], key: string) => {
    const i = colIndex.get(key);
    return i === undefined ? "" : cells[i] ?? "";
  };

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNum = r + 1;

    const ticket = cell(cells, "ticket").trim();
    const openingRaw = cell(cells, "opening_time_utc").trim();
    const symbolRaw = cell(cells, "symbol").trim();
    const typeRaw = cell(cells, "type").trim().toLowerCase();
    const profit = parseNumber(cell(cells, "profit"));

    const [datePart, timePart] = openingRaw.split("T");

    if (!datePart || !DATE_RE.test(datePart)) {
      issues.push({ row: rowNum, message: `Skipped — invalid or missing opening time ("${openingRaw || "empty"}").` });
      continue;
    }
    if (!symbolRaw) {
      issues.push({ row: rowNum, message: "Skipped — missing symbol." });
      continue;
    }
    if (typeRaw !== "buy" && typeRaw !== "sell") {
      issues.push({ row: rowNum, message: `Skipped — unrecognized trade type ("${cell(cells, "type").trim() || "empty"}").` });
      continue;
    }
    if (profit === null) {
      issues.push({ row: rowNum, message: `Skipped — invalid or missing profit ("${cell(cells, "profit").trim() || "empty"}").` });
      continue;
    }

    const commission = parseNumber(cell(cells, "commission")) ?? 0;
    const swap = parseNumber(cell(cells, "swap")) ?? 0;
    const symbol = instrumentFor(symbolRaw, accountType);
    const symbolSuffix = parseBrokerSymbol(symbolRaw).suffix;
    if (symbolSuffix === "c") centSymbolRows++;
    else plainSymbolRows++;
    if (!hasKnownContractSize(symbolRaw, overrides)) unknownSizeSymbols.add(parseBrokerSymbol(symbolRaw).base);
    const direction = typeRaw === "buy" ? "long" : "short";
    const entryPrice = parseNumber(cell(cells, "opening_price"));
    const exitPrice = parseNumber(cell(cells, "closing_price"));
    const stopLossPrice = parseNumber(cell(cells, "stop_loss"));
    const takeProfitPrice = parseNumber(cell(cells, "take_profit"));
    const local = toLocalDateTime(datePart, timePart);

    const closingRaw = cell(cells, "closing_time_utc").trim();
    const [closingDatePart, closingTimePart] = closingRaw.split("T");
    const localExit =
      closingDatePart && DATE_RE.test(closingDatePart)
        ? toLocalDateTime(closingDatePart, closingTimePart)
        : { date: null, time: null };

    trades.push({
      entry_date: local.date ?? datePart,
      entry_time: local.time,
      exit_date: localExit.date,
      exit_time: localExit.time,
      instrument: symbol,
      asset_class: guessAssetClass(symbol),
      strategy: null,
      session: null,
      emotion: null,
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      stop_loss_price: stopLossPrice,
      take_profit_price: takeProfitPrice,
      size: (() => {
        const lots = parseNumber(cell(cells, "lots"));
        if (lots === null) return null;
        // Rounded to shed float noise (0.07 lots x 100 would otherwise
        // come out as 7.000000000000001 units).
        return Math.round(lots * contractSizeFor(symbol, overrides, accountType) * 1e8) / 1e8;
      })(),
      pnl: Math.round((profit + commission + swap) * 100) / 100,
      r_multiple: calculateRMultiple(direction, entryPrice, exitPrice, stopLossPrice),
      rules_followed: null,
      exit_reason: closeReasonToExitReason(cell(cells, "close_reason")),
      sl_movement: null,
      tp_movement: null,
      notes: null,
      screenshot_url: null,
      screenshot_file_id: null,
      tags: [],
      broker_ticket: ticket || null,
    });
  }

  const warnings: string[] = [];
  const totalRows = centSymbolRows + plainSymbolRows;
  if (accountType === "standard" && centSymbolRows > 0) {
    warnings.push(
      `${centSymbolRows} of ${totalRows} rows use cent-account symbols (ending in "c"), but the target account is a Standard account. Cent P&L is in cents, so importing it here would mix cents with dollars — set the account type to Cent in Settings → Accounts first, or import into your cent account.`
    );
  } else if (accountType === "cent" && plainSymbolRows > 0) {
    warnings.push(
      `${plainSymbolRows} of ${totalRows} rows don't use cent-account symbols (no "c" suffix), but the target account is a Cent account. Check this file came from your cent account.`
    );
  }
  if (unknownSizeSymbols.size > 0) {
    const list = [...unknownSizeSymbols].slice(0, 5).join(", ");
    const more = unknownSizeSymbols.size > 5 ? ` and ${unknownSizeSymbols.size - 5} more` : "";
    warnings.push(
      `No built-in contract size for ${list}${more} — size was recorded as lots × 1. Set the contract size in Settings → Broker import, then re-import to correct it.`
    );
  }

  return { trades, issues, warnings };
}
