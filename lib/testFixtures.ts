import { Trade } from "./trades";

let counter = 0;

/**
 * Builds a minimal, valid Trade for tests, with sensible defaults for every
 * field a given test doesn't care about — pass only what the test actually
 * asserts on. Not imported by any app code; test-only helper.
 */
export function makeTrade(overrides: Partial<Trade> = {}): Trade {
  counter++;
  return {
    id: `trade-${counter}`,
    account_id: "account-1",
    entry_date: "2026-01-01",
    entry_time: null,
    exit_date: null,
    exit_time: null,
    instrument: "EURUSD",
    asset_class: null,
    strategy: null,
    session: null,
    emotion: null,
    direction: "long",
    entry_price: null,
    exit_price: null,
    stop_loss_price: null,
    take_profit_price: null,
    size: null,
    pnl: 0,
    r_multiple: null,
    rules_followed: null,
    exit_reason: null,
    sl_movement: null,
    tp_movement: null,
    notes: null,
    screenshot_url: null,
    screenshot_file_id: null,
    tags: [],
    broker_ticket: null,
    created_at: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}
