import { describe, it, expect } from "vitest";
import { tradesToCsv } from "../csvExport";
import { parseTradesCsv } from "../csvImport";
import { makeTrade } from "../testFixtures";

// These exercise export -> import as a pair, since that's the actual path a
// user's data takes (export from this app, later re-import the same file —
// e.g. after switching accounts, or as a manual backup/restore). A bug in
// either half alone might not show up until the round trip is attempted.

describe("CSV export -> import round trip", () => {
  it("round-trips a simple trade's core fields", () => {
    const trade = makeTrade({
      entry_date: "2026-03-15",
      entry_time: "09:30",
      exit_date: "2026-03-15",
      exit_time: "10:15",
      instrument: "EURUSD",
      asset_class: "Forex",
      strategy: "Breakout",
      session: "London",
      direction: "long",
      entry_price: 1.085,
      exit_price: 1.09,
      stop_loss_price: 1.08,
      take_profit_price: 1.095,
      size: 10000,
      pnl: 50,
      r_multiple: 1,
      rules_followed: true,
      exit_reason: "take_profit",
      sl_movement: "held",
      tp_movement: "held",
      tags: ["momentum", "high-conviction"],
      notes: "Clean breakout, held to target.",
      broker_ticket: "TICKET-123",
    });

    const csv = tradesToCsv([trade]);
    const { trades, issues } = parseTradesCsv(csv);

    expect(issues).toEqual([]);
    expect(trades).toHaveLength(1);
    const result = trades[0];

    expect(result.entry_date).toBe("2026-03-15");
    expect(result.entry_time).toBe("09:30");
    expect(result.exit_date).toBe("2026-03-15");
    expect(result.exit_time).toBe("10:15");
    expect(result.instrument).toBe("EURUSD");
    expect(result.asset_class).toBe("Forex");
    expect(result.strategy).toBe("Breakout");
    expect(result.session).toBe("London");
    expect(result.direction).toBe("long");
    expect(result.entry_price).toBe(1.085);
    expect(result.exit_price).toBe(1.09);
    expect(result.stop_loss_price).toBe(1.08);
    expect(result.take_profit_price).toBe(1.095);
    expect(result.size).toBe(10000);
    expect(result.pnl).toBe(50);
    expect(result.r_multiple).toBe(1);
    expect(result.rules_followed).toBe(true);
    expect(result.exit_reason).toBe("take_profit");
    expect(result.sl_movement).toBe("held");
    expect(result.tp_movement).toBe("held");
    expect(result.tags).toEqual(["momentum", "high-conviction"]);
    expect(result.notes).toBe("Clean breakout, held to target.");
    expect(result.broker_ticket).toBe("TICKET-123");
  });

  it("round-trips notes containing commas, quotes, and newlines", () => {
    const trade = makeTrade({
      pnl: -20,
      notes: 'Entered too early, ignored the "wait for retest" rule.\nWon\'t repeat.',
    });
    const csv = tradesToCsv([trade]);
    const { trades, issues } = parseTradesCsv(csv);
    expect(issues).toEqual([]);
    expect(trades[0].notes).toBe(trade.notes);
  });

  it("round-trips a note that looks like a spreadsheet formula without corrupting it", () => {
    // Export guards against Excel/Sheets misreading a leading =/+/-/@ as a
    // formula by prefixing "'" — import must strip that guard back off.
    const trade = makeTrade({ pnl: 10, notes: "=SUM(A1:A2) was the setup, not a formula" });
    const csv = tradesToCsv([trade]);
    const { trades } = parseTradesCsv(csv);
    expect(trades[0].notes).toBe("=SUM(A1:A2) was the setup, not a formula");
  });

  it("round-trips negative P&L and price fields without triggering the formula guard", () => {
    // csvCell only formula-guards text fields, not numeric ones — a
    // negative P&L must not come back prefixed with a stray apostrophe.
    const trade = makeTrade({ pnl: -150.5, entry_price: -1 /* nonsensical but tests the guard */ });
    const csv = tradesToCsv([trade]);
    const { trades } = parseTradesCsv(csv);
    expect(trades[0].pnl).toBe(-150.5);
  });

  it("round-trips an empty tags array as no tags, and multiple tags separated by ;", () => {
    const noTags = makeTrade({ pnl: 5, tags: [] });
    const withTags = makeTrade({ pnl: 5, tags: ["a", "b", "c"] });
    const csv = tradesToCsv([noTags, withTags]);
    const { trades } = parseTradesCsv(csv);
    expect(trades[0].tags).toEqual([]);
    expect(trades[1].tags).toEqual(["a", "b", "c"]);
  });

  it("round-trips multiple trades in entry-date order", () => {
    const t1 = makeTrade({ entry_date: "2026-01-05", created_at: "2026-01-05T00:00:00.000Z", pnl: 10, instrument: "GBPUSD" });
    const t2 = makeTrade({ entry_date: "2026-01-01", created_at: "2026-01-01T00:00:00.000Z", pnl: 20, instrument: "USDJPY" });
    const csv = tradesToCsv([t1, t2]);
    const { trades } = parseTradesCsv(csv);
    // tradesToCsv sorts oldest-first regardless of input order
    expect(trades.map((t) => t.instrument)).toEqual(["USDJPY", "GBPUSD"]);
  });

  it("round-trips null/optional fields as null, not empty strings", () => {
    const trade = makeTrade({
      pnl: 0,
      entry_time: null,
      strategy: null,
      direction: null,
      entry_price: null,
      rules_followed: null,
      exit_reason: null,
      tags: [],
    });
    const csv = tradesToCsv([trade]);
    const { trades } = parseTradesCsv(csv);
    const result = trades[0];
    expect(result.entry_time).toBeNull();
    expect(result.strategy).toBeNull();
    expect(result.direction).toBeNull();
    expect(result.entry_price).toBeNull();
    expect(result.rules_followed).toBeNull();
    expect(result.exit_reason).toBeNull();
  });
});

describe("parseTradesCsv — invalid input handling", () => {
  it("reports an issue and returns no trades for an empty file", () => {
    const { trades, issues } = parseTradesCsv("");
    expect(trades).toEqual([]);
    expect(issues).toHaveLength(1);
  });

  it("rejects a file missing required columns", () => {
    const { trades, issues } = parseTradesCsv("Instrument,P&L\nEURUSD,100");
    expect(trades).toEqual([]);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toMatch(/doesn't look like a trade export/i);
  });

  it("skips a row with an invalid date and reports why, without failing the whole import", () => {
    const csv = "Entry date,Instrument,P&L\nnot-a-date,EURUSD,100\n2026-01-01,GBPUSD,50";
    const { trades, issues } = parseTradesCsv(csv);
    expect(trades).toHaveLength(1);
    expect(trades[0].instrument).toBe("GBPUSD");
    expect(issues).toHaveLength(1);
    expect(issues[0].row).toBe(2);
    expect(issues[0].message).toMatch(/invalid or missing date/i);
  });

  it("skips a row with a missing instrument and reports why", () => {
    const csv = "Entry date,Instrument,P&L\n2026-01-01,,100";
    const { trades, issues } = parseTradesCsv(csv);
    expect(trades).toEqual([]);
    expect(issues[0].message).toMatch(/missing instrument/i);
  });

  it("skips a row with an invalid P&L and reports why", () => {
    const csv = "Entry date,Instrument,P&L\n2026-01-01,EURUSD,not-a-number";
    const { trades, issues } = parseTradesCsv(csv);
    expect(trades).toEqual([]);
    expect(issues[0].message).toMatch(/invalid or missing P&L/i);
  });

  it("matches columns by header label, tolerating a reordered column set", () => {
    const csv = "Instrument,P&L,Entry date\nEURUSD,75,2026-02-01";
    const { trades, issues } = parseTradesCsv(csv);
    expect(issues).toEqual([]);
    expect(trades[0]).toMatchObject({ instrument: "EURUSD", pnl: 75, entry_date: "2026-02-01" });
  });

  it("matches legacy 'Date'/'Time' column labels to entry_date/entry_time", () => {
    const csv = "Date,Time,Instrument,P&L\n2026-01-01,14:30,EURUSD,25";
    const { trades, issues } = parseTradesCsv(csv);
    expect(issues).toEqual([]);
    expect(trades[0].entry_date).toBe("2026-01-01");
    expect(trades[0].entry_time).toBe("14:30");
  });

  it("ignores blank trailing rows rather than reporting them as issues", () => {
    const csv = "Entry date,Instrument,P&L\n2026-01-01,EURUSD,10\n\n";
    const { trades, issues } = parseTradesCsv(csv);
    expect(trades).toHaveLength(1);
    expect(issues).toEqual([]);
  });
});
