import { TradeInput } from "./trades";
import { parseCsvRows, parseNumber, ImportRowIssue, ParsedImport } from "./csvUtils";
import { calculateRMultiple } from "./metrics";

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
): { date: string; time: string | null } {
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
 *   tracks. Exness reports it in UTC; it's shifted to East Africa Time
 *   (UTC+3) before being split into entry_date / entry_time, since that's
 *   the timezone this journal logs in everywhere else.
 * - r_multiple is auto-calculated the same way the manual trade form does
 *   (reward ÷ risk, from entry/exit/stop-loss), so imported trades get an
 *   R multiple whenever a stop_loss value is present in the export.
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
    const direction = typeRaw === "buy" ? "long" : "short";
    const entryPrice = parseNumber(cell(cells, "opening_price"));
    const exitPrice = parseNumber(cell(cells, "closing_price"));
    const stopLossPrice = parseNumber(cell(cells, "stop_loss"));
    const local = toLocalDateTime(datePart, timePart);

    trades.push({
      entry_date: local.date,
      entry_time: local.time,
      instrument: symbol,
      asset_class: guessAssetClass(symbol),
      strategy: null,
      session: null,
      emotion: null,
      direction,
      entry_price: entryPrice,
      exit_price: exitPrice,
      stop_loss_price: stopLossPrice,
      size: parseNumber(cell(cells, "lots")),
      pnl: Math.round((profit + commission + swap) * 100) / 100,
      r_multiple: calculateRMultiple(direction, entryPrice, exitPrice, stopLossPrice),
      rules_followed: null,
      notes: closeReasonNote(cell(cells, "close_reason")),
      screenshot_url: null,
      tags: [],
      broker_ticket: ticket || null,
    });
  }

  return { trades, issues };
}
