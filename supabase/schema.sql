-- ============================================================
-- Trade journal — core schema (Phase 0)
-- Run this once in the Supabase SQL editor as a NEW query.
-- ============================================================

create extension if not exists "uuid-ossp";

-- Accounts: every other table hangs off this
create table accounts (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  broker text,
  currency text not null default 'USD',
  is_demo boolean not null default false,
  starting_balance numeric not null default 0,
  journal_start_date date not null default current_date,
  target_risk_pct numeric,
  target_monthly_pnl numeric,
  target_monthly_winrate numeric,
  created_at timestamptz not null default now()
);

-- Dropdown/reference lists, scoped per account
create table dropdown_settings (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  category text not null check (category in ('asset_class', 'strategy', 'session', 'emotion', 'tag')),
  value text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

-- Trades, scoped per account
create table trades (
  id uuid primary key default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  entry_date date not null,
  instrument text not null,
  asset_class text,
  strategy text,
  session text,
  emotion text,
  direction text check (direction in ('long', 'short')),
  entry_price numeric,
  exit_price numeric,
  size numeric,
  pnl numeric not null default 0,
  r_multiple numeric,
  rules_followed boolean,
  notes text,
  screenshot_url text,
  tags text[] default '{}',
  created_at timestamptz not null default now()
);

create index trades_account_idx on trades(account_id);
create index trades_date_idx on trades(entry_date);

-- Open access for a personal, single-user app (no login system).
-- Safe because only you have the project URL and anon key.
alter table accounts enable row level security;
alter table dropdown_settings enable row level security;
alter table trades enable row level security;

create policy "public read/write accounts" on accounts for all using (true) with check (true);
create policy "public read/write dropdown_settings" on dropdown_settings for all using (true) with check (true);
create policy "public read/write trades" on trades for all using (true) with check (true);

-- ============================================================
-- Seed: one demo account with realistic sample trades
-- ============================================================

insert into accounts (id, name, broker, currency, is_demo, starting_balance, journal_start_date, target_risk_pct, target_monthly_pnl, target_monthly_winrate)
values ('00000000-0000-0000-0000-000000000001', 'Demo account', 'Paper broker', 'USD', true, 25000, current_date - interval '90 days', 1.0, 2500, 55);

insert into dropdown_settings (account_id, category, value, sort_order) values
('00000000-0000-0000-0000-000000000001', 'asset_class', 'Forex', 1),
('00000000-0000-0000-0000-000000000001', 'asset_class', 'Indices', 2),
('00000000-0000-0000-0000-000000000001', 'asset_class', 'Crypto', 3),
('00000000-0000-0000-0000-000000000001', 'strategy', 'Breakout', 1),
('00000000-0000-0000-0000-000000000001', 'strategy', 'Mean reversion', 2),
('00000000-0000-0000-0000-000000000001', 'strategy', 'Trend following', 3),
('00000000-0000-0000-0000-000000000001', 'session', 'London', 1),
('00000000-0000-0000-0000-000000000001', 'session', 'New York', 2),
('00000000-0000-0000-0000-000000000001', 'session', 'Asia', 3),
('00000000-0000-0000-0000-000000000001', 'emotion', 'Calm', 1),
('00000000-0000-0000-0000-000000000001', 'emotion', 'Confident', 2),
('00000000-0000-0000-0000-000000000001', 'emotion', 'Anxious', 3),
('00000000-0000-0000-0000-000000000001', 'emotion', 'Impatient', 4);

insert into trades (account_id, entry_date, instrument, asset_class, strategy, session, emotion, direction, entry_price, exit_price, size, pnl, r_multiple, rules_followed, notes) values
('00000000-0000-0000-0000-000000000001', current_date - interval '85 days', 'EUR/USD', 'Forex', 'Breakout', 'London', 'Calm', 'long', 1.0820, 1.0865, 1.0, 450, 1.8, true, 'Clean breakout above range high, held for full move.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '80 days', 'US30', 'Indices', 'Trend following', 'New York', 'Confident', 'long', 34200, 34410, 0.5, 210, 1.1, true, 'Rode the afternoon trend, exited into resistance.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '76 days', 'BTC/USD', 'Crypto', 'Mean reversion', 'Asia', 'Anxious', 'short', 43200, 43850, 0.2, -260, -1.3, false, 'Faded a move too early, size was slightly oversized.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '70 days', 'GBP/USD', 'Forex', 'Breakout', 'London', 'Calm', 'long', 1.2650, 1.2610, 1.0, -80, -0.4, true, 'Valid setup, stopped out on news spike.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '65 days', 'US30', 'Indices', 'Trend following', 'New York', 'Confident', 'short', 34800, 34550, 0.5, 250, 1.4, true, 'Shorted rejection at prior high, textbook.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '60 days', 'EUR/USD', 'Forex', 'Mean reversion', 'London', 'Impatient', 'short', 1.0910, 1.0940, 1.0, -300, -1.5, false, 'Entered before confirmation, chased the move.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '55 days', 'BTC/USD', 'Crypto', 'Breakout', 'Asia', 'Confident', 'long', 41200, 42100, 0.2, 180, 1.6, true, 'Range breakout with volume confirmation.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '48 days', 'GBP/USD', 'Forex', 'Trend following', 'London', 'Calm', 'long', 1.2705, 1.2760, 1.0, 550, 2.1, true, 'Best trade of the month, let it run to target.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '40 days', 'US30', 'Indices', 'Mean reversion', 'New York', 'Anxious', 'short', 35100, 35240, 0.5, -140, -0.9, false, 'Faded strength in a strong uptrend, against the rules.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '32 days', 'EUR/USD', 'Forex', 'Breakout', 'London', 'Confident', 'long', 1.0790, 1.0835, 1.0, 450, 1.7, true, 'Same setup as trade one, repeatable edge.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '24 days', 'BTC/USD', 'Crypto', 'Trend following', 'Asia', 'Calm', 'long', 44500, 45700, 0.2, 240, 1.9, true, 'Trailed stop through the move, exited on momentum loss.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '15 days', 'GBP/USD', 'Forex', 'Mean reversion', 'London', 'Impatient', 'short', 1.2830, 1.2870, 1.0, -400, -2.0, false, 'Oversized after two wins, discipline slipped.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '8 days', 'US30', 'Indices', 'Breakout', 'New York', 'Confident', 'long', 35600, 35810, 0.5, 210, 1.3, true, 'Opening range breakout, followed plan exactly.'),
('00000000-0000-0000-0000-000000000001', current_date - interval '3 days', 'EUR/USD', 'Forex', 'Trend following', 'London', 'Calm', 'long', 1.0870, 1.0910, 1.0, 400, 1.6, true, 'Continuation of the daily uptrend.');
