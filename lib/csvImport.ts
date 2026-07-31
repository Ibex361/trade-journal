import { TradeInput, Direction, ExitReason, StopMovement } from "./trades";
import { CSV_COLUMNS } from "./csvExport";
import { parseCsvRows, parseNumber, ImportRowIssue, ParsedImport } from "./csvUtils";

export type { ImportRowIssue, ParsedImport } from "./csvUtils";

// The export prefixes a cell with "'" when it starts with =, +, -, or @, so
// spreadsheet apps don't misread it as a formula. Undo that on the way back
// in — it's an artifact of round-tripping through Excel/Sheets, not data.
function stripFormulaGuard(value: string): string {
  return value.length > 1 && value[0] === "'" && /^[=+\-@]/.test(value.slice(1)) ? value.slice(1) : value;
}

function text(value: string): string | null {
  const v = stripFormulaGuard(value.trim());
  return v === "" ? null : v;
}

function bool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "true") return true;
  if (v === "no" || v === "false") return false;
  return null;
}

const EXIT_REASONS: ExitReason[] = ["stop_loss", "take_profit", "manual", "other"];
function exitReason(value: string): ExitReason | null {
  const v = value.trim().toLowerCase();
  return (EXIT_REASONS as string[]).includes(v) ? (v as ExitReason) : null;
}

const STOP_MOVEMENTS: StopMovement[] = ["held", "tightened", "widened"];
function stopMovement(value: string): StopMovement | null {
  const v = value.trim().toLowerCase();
  return (STOP_MOVEMENTS as string[]).includes(v) ? (v as StopMovement) : null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const LABEL_TO_KEY = new Map(CSV_COLUMNS.map((c) => [c.label.toLowerCase(), c.key]));

// "Date" / "Time" were this app's original column labels, before entry vs.
// exit was a distinction worth making. Files exported before that rename
// still use them — keep matching them to entry_date/entry_time so those
// older exports still import cleanly.
const LEGACY_LABEL_TO_KEY = new Map<string, keyof TradeInput>([
  ["date", "entry_date"],
  ["time", "entry_time"],
]);

/**
 * Parses CSV text produced by this app's own "Export all trades" / "Export
 * this month" into TradeInput rows ready to insert. Matches columns by
 * header label rather than position, so it tolerates reordered columns and
 * files exported before a column (e.g. Time, Broker Ticket) existed. Rows
 * missing a valid date, instrument, or P&L are skipped and reported rather
 * than guessed at.
 */
export function parseTradesCsv(csvText: string): ParsedImport {
  const rows = parseCsvRows(csvText).filter((r) => !(r.length === 1 && r[0].trim() === ""));
  const issues: ImportRowIssue[] = [];
  const trades: TradeInput[] = [];

  if (rows.length === 0) {
    return { trades, issues: [{ row: 0, message: "The file is empty." }] };
  }

  const colIndex = new Map<keyof TradeInput, number>();
  rows[0].forEach((label, i) => {
    const normalized = label.trim().toLowerCase();
    const key = LABEL_TO_KEY.get(normalized) ?? LEGACY_LABEL_TO_KEY.get(normalized);
    if (key) colIndex.set(key as keyof TradeInput, i);
  });

  if (!colIndex.has("entry_date") || !colIndex.has("instrument") || !colIndex.has("pnl")) {
    return {
      trades,
      issues: [
        {
          row: 0,
          message:
            'This doesn\'t look like a trade export — missing "Entry date", "Instrument", or "P&L" columns.',
        },
      ],
    };
  }

  const cell = (cells: string[], key: keyof TradeInput) => {
    const i = colIndex.get(key);
    return i === undefined ? "" : cells[i] ?? "";
  };

  for (let r = 1; r < rows.length; r++) {
    const cells = rows[r];
    const rowNum = r + 1; // 1-based, matches what a spreadsheet app shows including the header

    const entry_date = cell(cells, "entry_date").trim();
    const instrument = text(cell(cells, "instrument"));
    const pnl = parseNumber(cell(cells, "pnl"));

    if (!DATE_RE.test(entry_date)) {
      issues.push({ row: rowNum, message: `Skipped — invalid or missing date ("${entry_date || "empty"}").` });
      continue;
    }
    if (!instrument) {
      issues.push({ row: rowNum, message: "Skipped — missing instrument." });
      continue;
    }
    if (pnl === null) {
      issues.push({ row: rowNum, message: `Skipped — invalid or missing P&L ("${cell(cells, "pnl").trim() || "empty"}").` });
      continue;
    }

    const timeRaw = cell(cells, "entry_time").trim();
    const exitDateRaw = cell(cells, "exit_date").trim();
    const exitTimeRaw = cell(cells, "exit_time").trim();
    const directionRaw = cell(cells, "direction").trim().toLowerCase();
    const tagsRaw = cell(cells, "tags").trim();

    trades.push({
      entry_date,
      entry_time: TIME_RE.test(timeRaw) ? timeRaw : null,
      exit_date: DATE_RE.test(exitDateRaw) ? exitDateRaw : null,
      exit_time: TIME_RE.test(exitTimeRaw) ? exitTimeRaw : null,
      instrument,
      asset_class: text(cell(cells, "asset_class")),
      strategy: text(cell(cells, "strategy")),
      session: text(cell(cells, "session")),
      emotion: text(cell(cells, "emotion")),
      direction: directionRaw === "long" || directionRaw === "short" ? (directionRaw as Direction) : null,
      entry_price: parseNumber(cell(cells, "entry_price")),
      exit_price: parseNumber(cell(cells, "exit_price")),
      stop_loss_price: parseNumber(cell(cells, "stop_loss_price")),
      take_profit_price: parseNumber(cell(cells, "take_profit_price")),
      size: parseNumber(cell(cells, "size")),
      pnl,
      r_multiple: parseNumber(cell(cells, "r_multiple")),
      rules_followed: bool(cell(cells, "rules_followed")),
      exit_reason: exitReason(cell(cells, "exit_reason")),
      sl_movement: stopMovement(cell(cells, "sl_movement")),
      tp_movement: stopMovement(cell(cells, "tp_movement")),
      notes: text(cell(cells, "notes")),
      screenshot_url: null,
      tags: tagsRaw ? tagsRaw.split(";").map((t) => stripFormulaGuard(t.trim())).filter(Boolean) : [],
      broker_ticket: text(cell(cells, "broker_ticket")),
    });
  }

  return { trades, issues };
}
