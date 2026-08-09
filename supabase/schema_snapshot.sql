-- ============================================================
-- Trade journal — CURRENT SCHEMA SNAPSHOT
-- Generated live from the "Trade Journal v2" Supabase project
-- (project ref xflmxulzjoohnlbklaml) on 2026-08-09.
--
-- This is a REFERENCE DOCUMENT, not a migration to run. It reflects
-- the database as it actually is right now, after all 21 migrations
-- in supabase/migrations/ have been applied (000 through 020).
--
-- The migration files remain the source of truth for how the schema
-- got here and in what order. Regenerate this file after any future
-- schema change so it doesn't go stale the way the old schema.sql did
-- (that file — now migrations/000_initial_schema.sql — stopped being
-- updated after phase 1 and silently drifted ~13 migrations out of
-- date before this cleanup caught it).
--
-- NOTE: the "trade-screenshots" Supabase Storage bucket and its RLS
-- policies (created in migrations/005_screenshot_storage_bucket.sql
-- and updated in 007_auth_rls_policies.sql) do NOT exist on this
-- project — screenshots moved to ImageKit and the bucket was never
-- (re)created here. Those two migrations are historically accurate
-- but are no-ops against this project's actual storage state.
-- ============================================================

create table accounts (
  id uuid not null default uuid_generate_v4(),
  name text not null,
  broker text,
  currency text not null default 'USD'::text,
  is_demo boolean not null default false,
  starting_balance numeric not null default 0,
  journal_start_date date not null default CURRENT_DATE,
  target_risk_pct numeric,
  target_monthly_pnl numeric,
  target_monthly_winrate numeric,
  created_at timestamp with time zone not null default now(),
  is_archived boolean not null default false,
  primary key (id)
);

create unique index accounts_name_unique on accounts using btree (lower(name));

create table dropdown_settings (
  id uuid not null default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  category text not null check (category = any (array['asset_class'::text, 'strategy'::text, 'session'::text, 'emotion'::text])),
  value text not null,
  sort_order integer not null default 0,
  created_at timestamp with time zone not null default now(),
  primary key (id)
);

create table trades (
  id uuid not null default uuid_generate_v4(),
  account_id uuid not null references accounts(id) on delete cascade,
  entry_date date not null,
  instrument text not null,
  asset_class text,
  strategy text,
  session text,
  emotion text,
  direction text check (direction = any (array['long'::text, 'short'::text])),
  entry_price numeric,
  exit_price numeric,
  size numeric,
  pnl numeric not null default 0,
  r_multiple numeric,
  rules_followed boolean,
  notes text,
  screenshot_url text,
  tags text[] default '{}'::text[],
  created_at timestamp with time zone not null default now(),
  stop_loss_price numeric,
  entry_time time without time zone,
  broker_ticket text,
  exit_date date,
  exit_time time without time zone,
  take_profit_price numeric,
  exit_reason text check (exit_reason = any (array['stop_loss'::text, 'take_profit'::text, 'manual'::text, 'other'::text])),
  sl_movement text check (sl_movement = any (array['held'::text, 'tightened'::text, 'widened'::text])),
  tp_movement text check (tp_movement = any (array['held'::text, 'tightened'::text, 'widened'::text])),
  screenshot_file_id text,
  primary key (id)
);

create index trades_account_idx on trades using btree (account_id);
create index trades_date_idx on trades using btree (entry_date);
create index trades_broker_ticket_idx on trades using btree (account_id, broker_ticket);

create table notes (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  title text not null default 'Untitled'::text,
  content jsonb not null default '{"type": "doc", "content": [{"type": "paragraph"}]}'::jsonb,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  tags text[] not null default '{}'::text[],
  linked_trade_ids uuid[] not null default '{}'::uuid[],
  linked_strategy text,
  primary key (id)
);

create index notes_account_idx on notes using btree (account_id);
create index notes_updated_idx on notes using btree (account_id, updated_at desc);
create index notes_tags_idx on notes using gin (tags);
create index notes_linked_trade_ids_idx on notes using gin (linked_trade_ids);

create table exness_contract_overrides (
  id uuid not null default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  contract_size numeric not null,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  primary key (id),
  unique (account_id, symbol)
);

create index exness_contract_overrides_account_idx on exness_contract_overrides using btree (account_id);

-- ============================================================
-- Row Level Security
-- Every table: RLS enabled, single "authenticated read/write" policy
-- (auth.role() = 'authenticated'), for all commands. No per-row
-- ownership — this is a single-user app gated by Supabase Auth.
-- ============================================================

alter table accounts enable row level security;
create policy "authenticated read/write accounts" on accounts
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table dropdown_settings enable row level security;
create policy "authenticated read/write dropdown_settings" on dropdown_settings
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table trades enable row level security;
create policy "authenticated read/write trades" on trades
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table notes enable row level security;
create policy "authenticated read/write notes" on notes
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

alter table exness_contract_overrides enable row level security;
create policy "authenticated read/write exness_contract_overrides" on exness_contract_overrides
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
