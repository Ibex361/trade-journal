import { supabase } from "./supabaseClient";
import type { Trade } from "./trades";
import type { FeedInput, TriggerInput } from "./backtestValidation";

export type BacktestStatus = "pending" | "running" | "completed" | "failed";

export type BacktestRun = {
  id: string;
  name: string;
  script_filename: string;
  start_date: string;
  end_date: string;
  status: BacktestStatus;
  error_message: string | null;
  // Backtrader's own analyzer output, stored and displayed as-is — see
  // supabase/migrations/025_backtests.sql. Null until the run completes.
  backtrader_analysis: Record<string, unknown> | null;
  created_at: string;
  completed_at: string | null;
};

// The list page never needs the (potentially large) uploaded script or the
// analysis blob per row — named columns rather than select("*") so a long
// history of runs doesn't ship every run's full source code and analysis
// just to render one line each. Only `backtrader_analysis` is fetched on
// the detail page (fetchBacktestRun), and only there is it needed.
const LIST_COLUMNS = "id, name, script_filename, start_date, end_date, status, error_message, created_at, completed_at";

export type BacktestRunSummary = Omit<BacktestRun, "backtrader_analysis">;

export type BacktestFeed = { id: string; run_id: string; instrument: string; timeframe: string };

export type BacktestTrade = {
  id: string;
  run_id: string;
  instrument: string;
  direction: "long" | "short" | null;
  entry_date: string;
  entry_time: string | null;
  exit_date: string | null;
  exit_time: string | null;
  entry_price: number | null;
  exit_price: number | null;
  size: number | null;
  pnl: number;
};

export async function fetchBacktestRuns() {
  return supabase.from("backtest_runs").select(LIST_COLUMNS).order("created_at", { ascending: false });
}

// script_source is deliberately NOT selected: it can be hundreds of KB and
// nothing in the UI displays it — only run_backtest.py reads it.
export async function fetchBacktestRun(id: string) {
  return supabase
    .from("backtest_runs")
    .select(`${LIST_COLUMNS}, backtrader_analysis`)
    .eq("id", id)
    .maybeSingle();
}

export async function fetchBacktestFeeds(runId: string) {
  return supabase.from("backtest_run_feeds").select("*").eq("run_id", runId).order("instrument").order("timeframe");
}

/**
 * Feeds for many runs in one round trip — the list page shows each run's
 * instruments, and one query for all of them beats N (one per row).
 */
export async function fetchFeedsForRuns(runIds: string[]) {
  if (runIds.length === 0) return { data: [] as BacktestFeed[], error: null };
  return supabase.from("backtest_run_feeds").select("*").in("run_id", runIds);
}

// A run can produce thousands of trades (a multi-year 15min strategy). The
// server caps a single response at 1000 rows by default, so page through
// rather than silently truncating — a truncated trades table beside
// Backtrader's own (complete) trade count would look like a bug.
const TRADES_PAGE = 1000;

export async function fetchBacktestTrades(runId: string): Promise<{ data: BacktestTrade[]; error: string | null }> {
  const all: BacktestTrade[] = [];
  for (let from = 0; ; from += TRADES_PAGE) {
    const { data, error } = await supabase
      .from("backtest_trades")
      .select("*")
      .eq("run_id", runId)
      .order("entry_date", { ascending: true })
      .order("entry_time", { ascending: true })
      .order("id", { ascending: true }) // stable tiebreak so pages never skip/duplicate rows
      .range(from, from + TRADES_PAGE - 1);
    if (error) return { data: [], error: error.message };
    all.push(...((data ?? []) as BacktestTrade[]));
    if (!data || data.length < TRADES_PAGE) break;
  }
  return { data: all, error: null };
}

/**
 * Creates the run + its feed rows, then asks the server to dispatch the
 * workflow. If the DISPATCH fails after the rows exist, the run is marked
 * failed with the reason rather than left 'pending' forever (nothing
 * would ever pick it up) or deleted (the user would lose their uploaded
 * script and settings and have to re-enter everything to retry).
 */
export async function createAndStartBacktest(input: TriggerInput): Promise<{ id: string | null; error: string | null }> {
  const { data: run, error: runError } = await supabase
    .from("backtest_runs")
    .insert({
      name: input.name,
      script_filename: input.scriptFilename,
      script_source: input.scriptSource,
      start_date: input.startDate,
      end_date: input.endDate,
    })
    .select("id")
    .single();
  if (runError || !run) return { id: null, error: runError?.message ?? "Couldn't create the backtest." };

  const { error: feedsError } = await supabase
    .from("backtest_run_feeds")
    .insert(input.feeds.map((f: FeedInput) => ({ run_id: run.id, instrument: f.instrument, timeframe: f.timeframe })));
  if (feedsError) {
    // No feeds = a run that can never execute; clean it up rather than leave a dead row.
    await supabase.from("backtest_runs").delete().eq("id", run.id);
    return { id: null, error: feedsError.message };
  }

  let dispatchError: string | null = null;
  try {
    const res = await fetch("/api/backtests/trigger", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => null);
      dispatchError = body?.error ?? `The server couldn't start the backtest (HTTP ${res.status}).`;
    }
  } catch {
    dispatchError = "Couldn't reach the server to start the backtest.";
  }

  if (dispatchError) {
    await supabase
      .from("backtest_runs")
      .update({ status: "failed", error_message: `Couldn't start the workflow: ${dispatchError}`, completed_at: new Date().toISOString() })
      .eq("id", run.id);
    // The run exists (as 'failed') so the user lands on its page and sees
    // exactly why — not a dead form with the error and no trace of the run.
    return { id: run.id, error: null };
  }
  return { id: run.id, error: null };
}

/** Deletes a run; its feeds and trades go with it via ON DELETE CASCADE. Candles are intentionally NOT touched — see sync-backtest-candles.ts's header. */
export async function deleteBacktestRun(id: string) {
  return supabase.from("backtest_runs").delete().eq("id", id);
}

/**
 * Adapts a backtest trade to the `Trade` shape TradeChartModal renders.
 * The modal only reads instrument, entry/exit date+time, direction,
 * entry/exit price and pnl; everything else on `Trade` is a live-journal
 * concept (strategy, emotion, screenshot...) that has no meaning for a
 * simulated trade, so it gets an inert null/empty value here rather than
 * the modal growing a second prop type.
 */
export function backtestTradeToChartTrade(t: BacktestTrade): Trade {
  return {
    id: t.id,
    account_id: "",
    entry_date: t.entry_date,
    entry_time: t.entry_time,
    exit_date: t.exit_date,
    exit_time: t.exit_time,
    instrument: t.instrument,
    asset_class: null,
    strategy: null,
    session: null,
    emotion: null,
    direction: t.direction,
    entry_price: t.entry_price,
    exit_price: t.exit_price,
    stop_loss_price: null,
    take_profit_price: null,
    size: t.size,
    pnl: t.pnl,
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
    created_at: "",
  };
}

/** A run is still in flight (worth polling) while pending or running. */
export function isRunActive(status: BacktestStatus): boolean {
  return status === "pending" || status === "running";
}

/**
 * Adapts a BacktestTrade into the `Trade` shape TradeChartModal consumes.
 *
 * The chart only reads instrument, direction, entry/exit price, entry/exit
 * date+time and pnl. Every OTHER Trade field is filled with an explicit
 * neutral value below rather than the whole object being cast -- so if
 * `Trade` ever gains a required field, this stops typechecking and gets
 * looked at, instead of the chart quietly receiving `undefined` for it.
 * The date/time columns need no conversion: run_backtest.py already wrote
 * them in the app's local (UTC+3) convention, which is exactly what
 * computeTradeChartWindow expects (that cross-language contract is pinned
 * by scripts/backtest/test_run_backtest.py).
 */
export function backtestTradeToTrade(t: BacktestTrade): Trade {
  return {
    id: t.id,
    account_id: "",
    entry_date: t.entry_date,
    entry_time: t.entry_time,
    exit_date: t.exit_date,
    exit_time: t.exit_time,
    instrument: t.instrument,
    asset_class: null,
    strategy: null,
    session: null,
    emotion: null,
    direction: t.direction,
    entry_price: t.entry_price,
    exit_price: t.exit_price,
    stop_loss_price: null,
    take_profit_price: null,
    size: t.size,
    pnl: t.pnl,
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
    created_at: "",
  };
}
