import { TradeInput } from "./trades";
import { parseCsvRows, parseNumber, ImportRowIssue, ParsedImport } from "./csvUtils";

export type { ImportRowIssue, ParsedImport } from "./csvUtils";

// Columns this parser actually needs to recognize the file and build a
// trade. Exness' export has more columns than this (original_position_size,
// take_profit, equity, margin_level) that this app has no field for, so
// they're read from the row when useful and otherwise left alone.
const REQUIRED_HEADERS = ["ticket", "opening_time_utc", "symbol", "type", "profit"];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Exness suffixes symbols with a lowercase "m" on some account types
// (XAUUSDm, BTCUSDm, EURUSDm) that isn't part of the actual instrument
// name — strip it so the instrument matches what you'd type by hand.
function cleanSymbol(symbol: string): string {
  return /^[A-Z0-9]{3,}m$/.test(symbol) ? symbol.slice(0, -1) : symbol;
}

// Best-effort category guess from the cleaned symbol, purely to save
// re-typing it for every row — left null (and easy to edit per-trade
// afterward) for anything not confidently recognized.
function guessAssetClass(symbol: string): string | null {
  const s = symbol.toUpperCase();
  if (/^(XAU|XAG|XPT|XPD)/.test(s)) return "Metals";
  if (/(BTC|ETH|LTC|XRP|SOL|DOGE|ADA|BNB|DOT|AVAX)/.test(s)) return "Crypto";
  if (/^(US30|US100|US500|USTEC|SPX500|GER30|GER40|UK100|JPN225|AUS200|FRA40)/.test(s)) return "Indices";
  if (/^[A-Z]{6}$/.test(s)) return "Forex";
  return null;
}

function closeReasonNote(reason: string): string | null {
  switch (reason.trim().toLowerCase()) {
    case "sl":
      return "Closed by stop loss.";
    case "tp":
      return "Closed by take profit.";
    case "user":
      return "Closed manually.";
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
 * - Times come in as opening_time_utc / closing_time_utc — only the
 *   opening time is kept, since that's what the app's "time of day" field
 *   tracks. It's stored exactly as exported, in UTC, not converted to a
 *   local timezone.
 * - Each row's broker "ticket" is kept as broker_ticket, so a re-import of
 *   an overlapping date range can be de-duplicated by the caller instead
 *   of creating repeat trades.
 * - take_profit, equity, and margin_level have no matching field in this
 *   app and are dropped rather than stuffed somewhere they don't belong.
 */
export function parseExnessCsv(csvText: string): ParsedImport {
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
    const symbol = cleanSymbol(symbolRaw);

    trades.push({
      entry_date: datePart,
      entry_time: timePart && /^\d{2}:\d{2}(:\d{2})?/.test(timePart) ? timePart.slice(0, 8) : null,
      instrument: symbol,
      asset_class: guessAssetClass(symbol),
      strategy: null,
      session: null,
      emotion: null,
      direction: typeRaw === "buy" ? "long" : "short",
      entry_price: parseNumber(cell(cells, "opening_price")),
      exit_price: parseNumber(cell(cells, "closing_price")),
      stop_loss_price: parseNumber(cell(cells, "stop_loss")),
      size: parseNumber(cell(cells, "lots")),
      pnl: Math.round((profit + commission + swap) * 100) / 100,
      r_multiple: null,
      rules_followed: null,
      notes: closeReasonNote(cell(cells, "close_reason")),
      screenshot_url: null,
      tags: [],
      broker_ticket: ticket || null,
    });
  }

  return { trades, issues };
}
