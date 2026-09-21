import { describe, it, expect } from "vitest";
import fixture from "./fixtures/backtrader_analysis.json";
import { buildAnalysisSections, buildHeadlines, flattenAnalysis, formatValue, humanizeKey, reportedClosedTrades } from "../backtestAnalysis";

// fixtures/backtrader_analysis.json is REAL output captured from
// backtest_core.run_backtest (Backtrader 1.9.78) on a reversing strategy —
// not a hand-written approximation — so these tests break if the display
// layer stops fitting what the worker actually stores.
const analysis = fixture as Record<string, unknown>;

describe("formatValue", () => {
  it("integers keep full precision with thousands separators", () => {
    expect(formatValue(307)).toBe("307");
    expect(formatValue(1234567)).toBe("1,234,567");
    expect(formatValue(0)).toBe("0");
  });
  it("floats get up to 4 decimals", () => {
    expect(formatValue(0.8569033936275046)).toBe("0.8569");
    expect(formatValue(-110.03027530114818)).toBe("-110.0303");
  });
  it("tiny magnitudes use exponent form instead of a misleading 0.0000", () => {
    expect(formatValue(2.96e-7)).toBe("2.960e-7");
    expect(formatValue(-0.00001)).toBe("-1.000e-5");
  });
  it("null/undefined/NaN/Infinity render as an em dash", () => {
    for (const v of [null, undefined, NaN, Infinity, -Infinity]) expect(formatValue(v)).toBe("—");
  });
  it("booleans and strings", () => {
    expect(formatValue(true)).toBe("Yes");
    expect(formatValue(false)).toBe("No");
    expect(formatValue("abc")).toBe("abc");
  });
});

describe("humanizeKey", () => {
  it("uses known relabels for Backtrader's terse keys", () => {
    expect(humanizeKey("rnorm100")).toBe("Annualized return (%)");
    expect(humanizeKey("moneydown")).toBe("Money down");
  });
  it("humanizes unknown keys", () => {
    expect(humanizeKey("someNewMetric")).toBe("Some New Metric"); // camelCase boundaries keep their capitals
    expect(humanizeKey("snake_case_key")).toBe("Snake case key");
  });
  it("leaves date-like keys (Calmar/AnnualReturn) untouched", () => {
    expect(humanizeKey("2026")).toBe("2026");
    expect(humanizeKey("2026-01-31T00:00:00")).toBe("2026-01-31T00:00:00");
  });
});

describe("flattenAnalysis", () => {
  it("builds path labels", () => {
    const rows = flattenAnalysis({ won: { pnl: { total: 5 } } });
    expect(rows).toEqual([{ label: "Won › P&L › Total", value: "5", raw: 5 }]);
  });
  it("does not lose or invent leaves: leaf count equals the fixture's leaf count", () => {
    const countLeaves = (n: unknown): number =>
      typeof n === "object" && n !== null ? Object.values(n).reduce<number>((a, v) => a + countLeaves(v), 0) : 1;
    expect(flattenAnalysis(analysis).length).toBe(countLeaves(analysis));
  });
  it("empty / scalar top-level yields no rows", () => {
    expect(flattenAnalysis(null)).toEqual([]);
    expect(flattenAnalysis(5)).toEqual([]);
  });
  it("arrays render joined, not expanded", () => {
    expect(flattenAnalysis({ xs: [1, 2, 3] }, [])[0].value).toBe("1, 2, 3");
  });
});

describe("buildAnalysisSections", () => {
  const sections = buildAnalysisSections(analysis);

  it("orders known analyzers first, in the documented order", () => {
    expect(sections.map((s) => s.key)).toEqual(["TradeAnalyzer", "Returns", "DrawDown", "TimeDrawDown", "SharpeRatio", "SQN", "VWR", "Calmar", "AnnualReturn"]);
  });
  it("drops the redundant analyzer prefix from row labels", () => {
    const trades = sections.find((s) => s.key === "TradeAnalyzer")!;
    expect(trades.rows.some((r) => r.label.startsWith("Trade"))).toBe(false);
    expect(trades.rows.find((r) => r.label === "Total › Closed")?.value).toBe("307");
  });
  it("shows Backtrader's own numbers unchanged", () => {
    const dd = sections.find((s) => s.key === "DrawDown")!;
    const max = dd.rows.find((r) => r.label === "Max › Drawdown")!;
    expect(max.raw).toBe((analysis.DrawDown as { max: { drawdown: number } }).max.drawdown);
  });
  it("null values (e.g. Calmar on a short run) render as a dash, not the string 'null'", () => {
    const calmar = sections.find((s) => s.key === "Calmar")!;
    expect(calmar.rows[0].value).toBe("—");
  });
  it("unknown future analyzers still render, after the known ones", () => {
    const s = buildAnalysisSections({ ...analysis, BrandNew: { thing: 3 } });
    expect(s[s.length - 1]).toMatchObject({ key: "BrandNew", title: "Brand New" });
    expect(s[s.length - 1].rows[0]).toMatchObject({ label: "Thing", value: "3" });
  });
  it("an errored analyzer surfaces its error text instead of vanishing", () => {
    const s = buildAnalysisSections({ Returns: { error: "ZeroDivisionError: x" } });
    expect(s[0].rows[0]).toMatchObject({ label: "Error", value: "ZeroDivisionError: x" });
  });
  it("null / undefined / non-object analysis gives no sections", () => {
    expect(buildAnalysisSections(null)).toEqual([]);
    expect(buildAnalysisSections(undefined)).toEqual([]);
  });
});

describe("buildHeadlines — values are read from Backtrader, never computed", () => {
  const h = buildHeadlines(analysis);
  const by = (l: string) => h.find((x) => x.label === l);

  it("copies Backtrader's numbers verbatim", () => {
    const t = analysis.TradeAnalyzer as { pnl: { net: { total: number } }; total: { closed: number }; won: { total: number }; lost: { total: number } };
    expect(by("Net P&L")?.raw).toBe(t.pnl.net.total);
    expect(by("Closed trades")?.raw).toBe(t.total.closed);
    expect(by("Won")?.raw).toBe(t.won.total);
    expect(by("Lost")?.raw).toBe(t.lost.total);
  });
  it("does NOT synthesize a win rate (Backtrader doesn't report one)", () => {
    expect(h.map((x) => x.label.toLowerCase()).some((l) => l.includes("win rate") || l.includes("win %"))).toBe(false);
  });
  it("tones net P&L by sign", () => {
    expect(by("Net P&L")?.tone).toBe("gain"); // fixture net is +2.22
    const neg = buildHeadlines({ TradeAnalyzer: { pnl: { net: { total: -5 } } } });
    expect(neg[0].tone).toBe("loss");
    const zero = buildHeadlines({ TradeAnalyzer: { pnl: { net: { total: 0 } } } });
    expect(zero[0].tone).toBe("neutral");
  });
  it("Sharpe/SQN show a dash when Backtrader couldn't compute them; other missing stats are omitted", () => {
    const sparse = buildHeadlines({ TradeAnalyzer: { total: { closed: 0 } }, SharpeRatio: { sharperatio: null } });
    const labels = sparse.map((x) => x.label);
    expect(labels).toContain("Closed trades");
    expect(sparse.find((x) => x.label === "Sharpe ratio")?.value).toBe("—");
    expect(sparse.find((x) => x.label === "SQN")?.value).toBe("—");
    expect(labels).not.toContain("Won"); // absent in a zero-trade run's analysis
  });
  it("null / empty analysis gives no headlines", () => {
    expect(buildHeadlines(null)).toEqual([]);
  });
});

describe("reportedClosedTrades", () => {
  it("reads Backtrader's own closed count", () => {
    expect(reportedClosedTrades(analysis)).toBe(307);
    expect(reportedClosedTrades(null)).toBeNull();
    expect(reportedClosedTrades({})).toBeNull();
  });
});
