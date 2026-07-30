import { TradeInput, Direction } from "./trades";
import { CSV_COLUMNS } from "./csvExport";

export type ImportRowIssue = { row: number; message: string };

export type ParsedImport = {
  trades: TradeInput[];
  issues: ImportRowIssue[];
};

/**
 * Splits raw CSV text into rows of cells, honoring RFC-4180 quoting —
 * a field wrapped in "..." can contain commas, newlines, and "" for an
 * escaped quote. A naive split("\n") + split(",") breaks on exactly the
 * kind of multi-line Notes field this app's own export produces, so this
 * walks the text character by character instead.
 */
function parseCsvRows(text: string): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1); // strip BOM
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let touchedRow = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
      touchedRow = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
      touchedRow = true;
    } else if (char === "\r") {
      // handled via \n
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      touchedRow = false;
    } else {
      field += char;
      touchedRow = true;
    }
  }
  if (touchedRow || field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

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

function num(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function bool(value: string): boolean | null {
  const v = value.trim().toLowerCase();
  if (v === "yes" || v === "true") return true;
  if (v === "no" || v === "false") return false;
  return null;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}(:\d{2})?$/;

const LABEL_TO_KEY = new Map(CSV_COLUMNS.map((c) => [c.label.toLowerCase(), c.key]));

/**
 * Parses CSV text produced by this app's own "Export all trades" / "Export
 * this month" into TradeInput rows ready to insert. Matches columns by
 * header label rather than position, so it tolerates reordered columns and
 * files exported before a column (e.g. Time) existed. Rows missing a valid
 * date, instrument, or P&L are skipped and reported rather than guessed at.
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
    const key = LABEL_TO_KEY.get(label.trim().toLowerCase());
    if (key) colIndex.set(key as keyof TradeInput, i);
  });

  if (!colIndex.has("entry_date") || !colIndex.has("instrument") || !colIndex.has("pnl")) {
    return {
      trades,
      issues: [
        {
          row: 0,
          message:
            'This doesn\'t look like a trade export — missing "Date", "Instrument", or "P&L" columns.',
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
    const pnl = num(cell(cells, "pnl"));

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
    const directionRaw = cell(cells, "direction").trim().toLowerCase();
    const tagsRaw = cell(cells, "tags").trim();

    trades.push({
      entry_date,
      entry_time: TIME_RE.test(timeRaw) ? timeRaw : null,
      instrument,
      asset_class: text(cell(cells, "asset_class")),
      strategy: text(cell(cells, "strategy")),
      session: text(cell(cells, "session")),
      emotion: text(cell(cells, "emotion")),
      direction: directionRaw === "long" || directionRaw === "short" ? (directionRaw as Direction) : null,
      entry_price: num(cell(cells, "entry_price")),
      exit_price: num(cell(cells, "exit_price")),
      stop_loss_price: num(cell(cells, "stop_loss_price")),
      size: num(cell(cells, "size")),
      pnl,
      r_multiple: num(cell(cells, "r_multiple")),
      rules_followed: bool(cell(cells, "rules_followed")),
      notes: text(cell(cells, "notes")),
      screenshot_url: null,
      tags: tagsRaw ? tagsRaw.split(";").map((t) => stripFormulaGuard(t.trim())).filter(Boolean) : [],
    });
  }

  return { trades, issues };
}
