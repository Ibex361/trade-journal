-- ============================================================
-- Phase 14 — Exness contract-size overrides
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER all earlier
-- migrations (including 019_drop_tag_settings.sql).
--
-- Backs the new "Broker import" Settings card: lets the user type any
-- Exness instrument symbol and set/override the contract size used to
-- convert that symbol's imported "lots" into the app's "units" size
-- convention (see lib/exnessContractSize.ts). An override here takes
-- priority over the app's built-in lookup table for that symbol on that
-- account — it doesn't replace the built-in table, it patches it.
--
-- Modeled on tag_settings' shape (017_tag_settings_table.sql):
-- account-scoped, one row per (account_id, symbol), same RLS policy.
-- ============================================================

create table exness_contract_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  contract_size numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, symbol)
);

create index exness_contract_overrides_account_idx on exness_contract_overrides(account_id);

alter table exness_contract_overrides enable row level security;

create policy "authenticated read/write exness_contract_overrides" on exness_contract_overrides
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
