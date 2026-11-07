import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseExnessCsv } from "../exnessImport";
import { calculatePnl } from "../metrics";
import { unitModelFor } from "../accountUnits";

// A real Exness Standard Cent account export (11 closed trades across a
// forex pair, gold and an index). Prices/lots/profits are the broker's own
// figures, so this file is ground truth for the cent unit model.
const CENT_CSV = readFileSync(join(__dirname, "fixtures", "exness_cent_history.csv"), "utf8");

const byTicket = (csv: string, opts?: Parameters<typeof parseExnessCsv>[2]) => {
  const parsed = parseExnessCsv(csv, undefined, opts);
  return { ...parsed, byTicket: new Map(parsed.trades.map((t) => [t.broker_ticket, t])) };
};

describe("parseExnessCsv — Standard Cent account", () => {
  const { trades, issues, warnings } = parseExnessCsv(CENT_CSV, undefined, { accountType: "cent" });

  it("imports every row with no issues or warnings", () => {
    expect(issues).toEqual([]);
    expect(warnings).toEqual([]);
    expect(trades).toHaveLength(11);
  });

  it("keeps the cent symbol exactly as exported (it names the archive feed)", () => {
    expect(new Set(trades.map((t) => t.instrument))).toEqual(new Set(["USTECc", "GBPUSDc", "XAUUSDc"]));
  });

  it("converts cent lots to true underlying units (lots x standard contract x 0.01)", () => {
    const sizes = Object.fromEntries(
      trades.map((t) => [t.instrument, new Set<number | null>()])
    ) as Record<string, Set<number | null>>;
    trades.forEach((t) => sizes[t.instrument].add(t.size));
    expect([...sizes["GBPUSDc"]]).toEqual([500]); // 0.5 lot x 1,000 units
    expect([...sizes["USTECc"]]).toEqual([0.01]); // 1 lot x 0.01 index contract
    expect([...sizes["XAUUSDc"]].sort()).toEqual([0.05, 0.1]); // oz: 0.05 / 0.1 lot x 1 oz
  });

  it("classifies by base symbol (the 'c' no longer hides forex/indices)", () => {
    const classOf = (symbol: string) => trades.find((t) => t.instrument === symbol)!.asset_class;
    expect(classOf("GBPUSDc")).toBe("Forex");
    expect(classOf("USTECc")).toBe("Indices");
    expect(classOf("XAUUSDc")).toBe("Metals");
  });

  it("stores P&L exactly as the broker reports it, in USC", () => {
    expect(byTicket(CENT_CSV, { accountType: "cent" }).byTicket.get("538231307")!.pnl).toBe(-36.32);
  });

  it("REGRESSION: unit model reproduces every broker P&L figure to within 0.1 USC", () => {
    // The strongest check available: price move x stored size x 100 (USD -> USC)
    // must land on Exness' own profit, for every trade, on three asset classes.
    const model = unitModelFor("cent");
    for (const t of trades) {
      const computed = calculatePnl(t.direction, t.entry_price, t.exit_price, t.size, model.moneyScale)!;
      expect(Math.abs(computed - t.pnl), `${t.instrument} ticket ${t.broker_ticket}`).toBeLessThan(0.1);
    }
  });
});

describe("parseExnessCsv — account-type mismatch handling", () => {
  it("warns (but still imports, with correct cent sizes) when cent symbols go into a Standard account", () => {
    const { trades, warnings } = parseExnessCsv(CENT_CSV, undefined, { accountType: "standard" });
    expect(trades).toHaveLength(11);
    expect(warnings!.some((w) => /cent-account symbols/.test(w) && /Standard account/.test(w))).toBe(true);
    // Sizing follows the symbol's own 'c' suffix, so it is still right even in a mis-typed account.
    expect(trades.find((t) => t.instrument === "GBPUSDc")!.size).toBe(500);
  });

  it("defaults to Standard when no account type is given (backwards compatible call shape)", () => {
    expect(parseExnessCsv(CENT_CSV).warnings!.length).toBeGreaterThan(0);
  });

  it("warns when a cent account is given a file without cent symbols", () => {
    const csv = CENT_CSV.replace(/USTECc/g, "USTEC");
    const { warnings } = parseExnessCsv(csv, undefined, { accountType: "cent" });
    expect(warnings!.some((w) => /don't use cent-account symbols/.test(w))).toBe(true);
  });
});

describe("parseExnessCsv — Standard account behavior is unchanged", () => {
  const HEADER = "ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason";
  const csv = [
    HEADER,
    "1,2026-11-03T09:00:00,2026-11-03T10:00:00,buy,0.1,0.1,XAUUSDm,3900.0,3910.0,,,-0.7,0,100,,,",
    "2,2026-11-03T09:00:00,2026-11-03T10:00:00,sell,1,1,EURUSD,1.1000,1.0990,,,,,100,,,",
  ].join("\n");

  it("strips the Standard 'm' suffix and sizes with the full contract", () => {
    const { trades, warnings } = parseExnessCsv(csv, undefined, { accountType: "standard" });
    expect(trades.map((t) => t.instrument)).toEqual(["XAUUSD", "EURUSD"]);
    expect(trades[0].size).toBe(10); // 0.1 lot x 100 oz
    expect(trades[1].size).toBe(100000);
    expect(trades[0].pnl).toBe(99.3); // profit + commission + swap
    expect(warnings).toEqual([]);
  });
});

describe("parseExnessCsv — unknown contract sizes are flagged, not silently guessed", () => {
  it("lists symbols that fell back to lots x 1", () => {
    const HEADER = "ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason";
    const csv = `${HEADER}\n9,2026-11-03T09:00:00,2026-11-03T10:00:00,buy,1,1,ZZZZZc,10,11,,,,,1,,,`;
    const { warnings } = parseExnessCsv(csv, undefined, { accountType: "cent" });
    expect(warnings!.some((w) => /ZZZZZ/.test(w) && /Broker import/.test(w))).toBe(true);
  });

  it("does not flag a symbol covered by an override", () => {
    const HEADER = "ticket,opening_time_utc,closing_time_utc,type,lots,original_position_size,symbol,opening_price,closing_price,stop_loss,take_profit,commission,swap,profit,equity,margin_level,close_reason";
    const csv = `${HEADER}\n9,2026-11-03T09:00:00,2026-11-03T10:00:00,buy,1,1,ZZZZZc,10,11,,,,,1,,,`;
    const { warnings, trades } = parseExnessCsv(csv, new Map([["ZZZZZC", 42]]), { accountType: "cent" });
    expect(warnings).toEqual([]);
    expect(trades[0].size).toBe(42);
  });
});
