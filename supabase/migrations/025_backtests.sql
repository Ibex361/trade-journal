-- ============================================================
-- Trade journal — Phase 13 migration (Backtesting)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations (including 024_drop_chart_symbol_overrides.sql).
--
-- Foundation tables for the Backtest page. Deliberately kept SEPARATE
-- from `trades`/`accounts` (not a `source` flag on the existing table,
-- not account-scoped) — a backtest run isn't tied to one broker account,
-- and mixing simulated trades into `trades` risks them silently
-- contaminating every live-trading analytics view (win rate, expectancy,
-- equity curve) that queries that table. See memory / chat history for
-- the fuller design discussion.
--
-- Three tables:
--   backtest_runs        — one row per backtest, holding its own status
--                           and Backtrader's raw analyzer output as-is
--                           (jsonb) rather than any webapp-computed
--                           metrics — the whole point being to show
--                           Backtrader's own numbers, not a
--                           reinterpretation of them.
--   backtest_run_feeds   — one row per (instrument, timeframe) a run's
--                           strategy actually uses. A strategy can
--                           declare multiple data feeds (multi-asset
--                           and/or multi-timeframe), so this is a
--                           child table, not columns on backtest_runs.
--   backtest_trades      — the trades Backtrader's own TradeAnalyzer
--                           produced for a run. Shaped closely to the
--                           existing `trades` table (same column names
--                           where the concept is identical) so
--                           TradeChartModal and related chart code can
--                           consume a backtest_trades row with minimal
--                           adaptation, but this is its own table, not
--                           `trades` with a flag.
--
-- No RLS ownership scoping beyond "authenticated" — same single-user
-- policy shape as every other table in this app since Phase 3.
-- ============================================================

create table backtest_runs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  script_filename text not null,
  -- The uploaded strategy's own Python source, stored verbatim so a run
  -- is fully reproducible from its own row (and so the workflow doesn't
  -- need the file to still exist anywhere else once queued) — see
  -- run_backtest.py, which pulls this column at run time.
  script_source text not null,
  start_date date not null,
  end_date date not null,
  status text not null default 'pending' check (status in ('pending', 'running', 'completed', 'failed')),
  -- Set only when status = 'failed' — surfaced in the run detail page so
  -- a failed run's cause doesn't require digging into Actions logs.
  error_message text,
  -- Backtrader's own analyzer output (TradeAnalyzer, DrawDown, SQN,
  -- SharpeRatio, etc. — see run_backtest.py's addanalyzer calls),
  -- json-serialized from each analyzer's own .get_analysis() call and
  -- stored as one blob per run, deliberately NOT reshaped into this
  -- app's own metrics vocabulary. Null until the run completes.
  backtrader_analysis jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index backtest_runs_created_idx on backtest_runs(created_at desc);
create index backtest_runs_status_idx on backtest_runs(status);

alter table backtest_runs enable row level security;

create policy "authenticated read/write backtest_runs" on backtest_runs
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


create table backtest_run_feeds (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references backtest_runs(id) on delete cascade,
  instrument text not null,
  timeframe text not null
);

create index backtest_run_feeds_run_idx on backtest_run_feeds(run_id);

alter table backtest_run_feeds enable row level security;

create policy "authenticated read/write backtest_run_feeds" on backtest_run_feeds
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');


create table backtest_trades (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references backtest_runs(id) on delete cascade,
  instrument text not null,
  direction text check (direction in ('long', 'short')),
  entry_date date not null,
  entry_time time,
  exit_date date,
  exit_time time,
  entry_price double precision,
  exit_price double precision,
  size double precision,
  pnl double precision not null
);

create index backtest_trades_run_idx on backtest_trades(run_id);

alter table backtest_trades enable row level security;

create policy "authenticated read/write backtest_trades" on backtest_trades
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
