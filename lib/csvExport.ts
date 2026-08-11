import { Trade } from "./trades";

// Column order/labels for the exported CSV. Kept explicit (rather than
// Object.keys(trade)) so column order is stable and internal fields like
// id/account_id/screenshot_file_id/created_at are left out. screenshot_url
// IS included — it's just a link to the hosted image, so round-tripping it
// through export/import keeps a trade's screenshot attached.
export const CSV_COLUMNS: { key: keyof Trade; label: string }[] = [
  { key: "entry_date", label: "Entry date" },
  { key: "entry_time", label: "Entry time" },
  { key: "exit_date", label: "Exit date" },
  { key: "exit_time", label: "Exit time" },
  { key: "instrument", label: "Instrument" },
  { key: "asset_class", label: "Asset class" },
  { key: "strategy", label: "Strategy" },
  { key: "session", label: "Session" },
  { key: "direction", label: "Direction" },
  { key: "entry_price", label: "Entry price" },
  { key: "exit_price", label: "Exit price" },
  { key: "stop_loss_price", label: "Stop loss price" },
  { key: "take_profit_price", label: "Take profit price" },
  { key: "size", label: "Size" },
  { key: "pnl", label: "P&L" },
  { key: "r_multiple", label: "R multiple" },
  { key: "rules_followed", label: "Rules followed" },
  { key: "exit_reason", label: "Exit reason" },
  { key: "sl_movement", label: "SL mov't" },
  { key: "tp_movement", label: "TP mov't" },
  { key: "emotion", label: "Emotion" },
  { key: "tags", label: "Tags" },
  { key: "notes", label: "Notes" },
  { key: "screenshot_url", label: "Screenshot" },
  { key: "broker_ticket", label: "Broker Ticket" },
];

function csvCell(value: unknown): string {
  let str: string;
  if (value === null || value === undefined) str = "";
  else if (Array.isArray(value)) str = value.join("; ");
  else if (typeof value === "boolean") str = value ? "Yes" : "No";
  else str = String(value);

  // Spreadsheet apps (Excel, Google Sheets) treat a cell starting with
  // =, +, -, or @ as a formula. A leading apostrophe forces it to be read
  // as plain text instead, so a note like "-50% today" can't trigger a
  // "this file contains formulas" warning (or worse) when reopened.
  // Only applied to actual text fields — numeric columns (P&L, prices,
  // R-multiple) legitimately start with "-" for negative values, and
  // prefixing those would turn real numbers into text in the spreadsheet.
  const isTextValue = typeof value === "string" || Array.isArray(value);
  if (isTextValue && /^[=+\-@]/.test(str)) {
    str = `'${str}`;
  }

  // Quote (and escape internal quotes) whenever the value could otherwise
  // break the CSV grid: commas, quotes, or newlines.
  if (/[",\n]/.test(str)) {
    str = `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/** Converts trades to a CSV string, one row per trade, oldest first. */
export function tradesToCsv(trades: Trade[]): string {
  const sorted = [...trades].sort(
    (a, b) => a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
  );
  const header = CSV_COLUMNS.map((c) => csvCell(c.label)).join(",");
  const rows = sorted.map((t) => CSV_COLUMNS.map((c) => csvCell(t[c.key])).join(","));
  return [header, ...rows].join("\r\n");
}

/** Triggers a browser download of the given CSV content as a file. */
export function downloadCsv(csv: string, filename: string) {
  // Leading BOM so Excel opens the UTF-8 file with correct encoding.
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/** Filesystem-safe slug, e.g. for building a download filename from an account name. */
export function slugify(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
