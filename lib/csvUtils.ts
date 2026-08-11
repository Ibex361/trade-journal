import type { TradeInput } from "./trades";

/**
 * Splits raw CSV text into rows of cells, honoring RFC-4180 quoting —
 * a field wrapped in "..." can contain commas, newlines, and "" for an
 * escaped quote. A naive split("\n") + split(",") breaks on exactly the
 * kind of multi-line Notes field this app's own export produces, so this
 * walks the text character by character instead.
 */
export function parseCsvRows(text: string): string[][] {
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

export function parseNumber(value: string): number | null {
  const v = value.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export type ImportRowIssue = { row: number; message: string };

export type ParsedImport = {
  trades: TradeInput[];
  issues: ImportRowIssue[];
};
