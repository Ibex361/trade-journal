// lib/backtestAnalysis.ts
//
// Turns Backtrader's raw analyzer output (backtest_runs.backtrader_analysis)
// into display rows. This is DISPLAY logic only, by explicit design: the
// whole point of the Backtest page is to show Backtrader's own numbers,
// not a re-derived version of them, so nothing here computes a metric.
// It only (a) flattens nested dicts into labeled rows, (b) formats
// numbers for reading, and (c) picks a headline set of values to show up
// top — each of which is copied straight out of the analysis, never
// calculated.

export type AnalysisRow = { label: string; value: string; raw: number | string | boolean | null };
export type AnalysisSection = { key: string; title: string; rows: AnalysisRow[] };

// Display order + friendly titles. Any analyzer present in the data but
// not listed here still renders (after these, under its own key) — a
// future analyzer added to run_backtest.py's ANALYZER_SPECS shows up
// without a frontend change.
const SECTION_ORDER: [key: string, title: string][] = [
  ["TradeAnalyzer", "Trades"],
  ["Returns", "Returns"],
  ["DrawDown", "Drawdown"],
  ["TimeDrawDown", "Time in drawdown"],
  ["SharpeRatio", "Sharpe ratio"],
  ["SQN", "System quality (SQN)"],
  ["VWR", "Variability-weighted return"],
  ["Calmar", "Calmar ratio"],
  ["AnnualReturn", "Annual return"],
];

// Backtrader's own field names are terse ("rnorm100", "moneydown"). These
// are relabels of Backtrader's keys — never of its values — for keys whose
// raw name is unreadable. Anything not listed falls back to a humanized
// version of the raw key.
const KEY_LABELS: Record<string, string> = {
  rtot: "Total return (log)",
  ravg: "Average return per bar",
  rnorm: "Annualized return",
  rnorm100: "Annualized return (%)",
  sharperatio: "Sharpe ratio",
  sqn: "SQN",
  vwr: "VWR",
  moneydown: "Money down",
  maxdrawdown: "Max drawdown",
  maxdrawdownperiod: "Max drawdown period (bars)",
  len: "Length (bars)",
  pnl: "P&L",
  won: "Won",
  lost: "Lost",
  long: "Long",
  short: "Short",
  gross: "Gross",
  net: "Net",
  streak: "Streaks",
  drawdown: "Drawdown",
  max: "Max",
  min: "Min",
  average: "Average",
  total: "Total",
  open: "Open",
  closed: "Closed",
  current: "Current",
  longest: "Longest",
  trades: "Trades",
};

export function humanizeKey(key: string): string {
  if (KEY_LABELS[key]) return KEY_LABELS[key];
  // ISO dates as keys (Calmar / TimeReturn are date-keyed) stay as-is.
  if (/^\d{4}(-\d{2}(-\d{2}(T[\d:]+)?)?)?$/.test(key)) return key;
  const spaced = key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/**
 * Formats one value for display. Never changes what the number IS, only
 * how it's printed: integers stay integers, floats get up to 4
 * significant decimal places, tiny/huge magnitudes fall back to
 * exponent form rather than printing as a misleading "0.0000", and
 * null (Backtrader's "couldn't compute this", after NaN sanitization)
 * renders as an em dash instead of the word "null".
 */
export function formatValue(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "—";
    if (Number.isInteger(value)) return value.toLocaleString("en-US");
    const abs = Math.abs(value);
    if (abs !== 0 && (abs < 0.0001 || abs >= 1e9)) return value.toExponential(3);
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
  }
  return String(value);
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/**
 * Flattens a nested analyzer dict into rows whose labels carry the path,
 * e.g. { won: { pnl: { total: 5 } } } -> "Won › P&L › Total": "5".
 * Arrays are rendered as a comma-joined value rather than expanded.
 */
export function flattenAnalysis(node: unknown, path: string[] = []): AnalysisRow[] {
  if (!isPlainObject(node)) {
    if (path.length === 0) return [];
    const raw = Array.isArray(node) ? node.map(formatValue).join(", ") : (node as AnalysisRow["raw"]);
    return [{ label: path.map(humanizeKey).join(" › "), value: Array.isArray(node) ? String(raw) : formatValue(node), raw: raw as AnalysisRow["raw"] }];
  }
  const rows: AnalysisRow[] = [];
  for (const [k, v] of Object.entries(node)) rows.push(...flattenAnalysis(v, [...path, k]));
  return rows;
}

/**
 * Ordered display sections for the whole analysis blob. A section whose
 * analyzer errored ({error: "..."}) still appears, showing the error as
 * its single row, so a failed analyzer is visible rather than silently
 * missing.
 */
export function buildAnalysisSections(analysis: Record<string, unknown> | null | undefined): AnalysisSection[] {
  if (!analysis || !isPlainObject(analysis)) return [];
  const known = new Set(SECTION_ORDER.map(([k]) => k));
  const ordered: [string, string][] = [
    ...SECTION_ORDER.filter(([k]) => k in analysis),
    ...Object.keys(analysis)
      .filter((k) => !known.has(k))
      .map((k): [string, string] => [k, humanizeKey(k)]),
  ];
  return ordered.map(([key, title]) => ({ key, title, rows: flattenAnalysis(analysis[key], [key]).map((r) => stripLeadingSection(r, key)) }));
}

// flattenAnalysis is seeded with the section key so scalar-only analyzers
// (e.g. { sqn: 1.2 } is an object, fine — but a bare scalar would have no
// path) still get a label; the section title already says which analyzer
// it is, so drop that redundant first path element from each label.
function stripLeadingSection(row: AnalysisRow, key: string): AnalysisRow {
  const prefix = `${humanizeKey(key)} › `;
  return row.label.startsWith(prefix) ? { ...row, label: row.label.slice(prefix.length) } : row;
}

export type Headline = { label: string; value: string; raw: number | null; tone: "neutral" | "gain" | "loss" };

function getNum(analysis: Record<string, unknown>, path: string[]): number | null {
  let cur: unknown = analysis;
  for (const p of path) {
    if (!isPlainObject(cur)) return null;
    cur = cur[p];
  }
  return typeof cur === "number" && Number.isFinite(cur) ? cur : null;
}

/**
 * The handful of values shown as big stat cards above the full panel.
 * EVERY value is read directly from Backtrader's own output (getNum just
 * walks a path) — including "won" and "lost" counts; nothing here is
 * computed. A win-rate percentage is deliberately absent: Backtrader
 * doesn't report one (only won/lost counts), and computing it here would
 * violate the "show only what Backtrader outputs" requirement. The won
 * and lost counts sit side by side so the ratio is readable at a glance.
 */
export function buildHeadlines(analysis: Record<string, unknown> | null | undefined): Headline[] {
  if (!analysis) return [];
  const spec: { label: string; path: string[]; tone?: "pnl" }[] = [
    { label: "Net P&L", path: ["TradeAnalyzer", "pnl", "net", "total"], tone: "pnl" },
    { label: "Closed trades", path: ["TradeAnalyzer", "total", "closed"] },
    { label: "Won", path: ["TradeAnalyzer", "won", "total"] },
    { label: "Lost", path: ["TradeAnalyzer", "lost", "total"] },
    { label: "Max drawdown %", path: ["DrawDown", "max", "drawdown"] },
    { label: "Sharpe ratio", path: ["SharpeRatio", "sharperatio"] },
    { label: "SQN", path: ["SQN", "sqn"] },
  ];
  return spec
    .map(({ label, path, tone }): Headline | null => {
      const raw = getNum(analysis, path);
      if (raw === null) return label === "Sharpe ratio" || label === "SQN" ? { label, value: "—", raw: null, tone: "neutral" } : null;
      return { label, value: formatValue(raw), raw, tone: tone === "pnl" ? (raw > 0 ? "gain" : raw < 0 ? "loss" : "neutral") : "neutral" };
    })
    .filter((h): h is Headline => h !== null);
}

/** Closed-trade count Backtrader itself reported, for reconciling against the trades table. */
export function reportedClosedTrades(analysis: Record<string, unknown> | null | undefined): number | null {
  return analysis ? getNum(analysis, ["TradeAnalyzer", "total", "closed"]) : null;
}
