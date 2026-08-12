-- ============================================================
-- Chart symbol overrides — candlestick chart feature
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER all earlier
-- migrations (including 022_bulk_tag_rename_functions.sql).
--
-- Backs the new "Chart symbols" Settings card: lets the user type any
-- instrument symbol logged in this app and set/override the Twelve Data
-- symbol used to fetch its candlestick chart (see
-- lib/chartSymbolMap.ts's resolveChartSymbol). An override here takes
-- priority over the app's built-in mapping table for that symbol on that
-- account — it doesn't replace the built-in table, it patches it.
--
-- Modeled directly on exness_contract_overrides' shape
-- (020_exness_contract_overrides.sql): account-scoped, one row per
-- (account_id, symbol), same RLS policy.
-- ============================================================

create table chart_symbol_overrides (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  symbol text not null,
  twelve_data_symbol text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (account_id, symbol)
);

create index chart_symbol_overrides_account_idx on chart_symbol_overrides(account_id);

alter table chart_symbol_overrides enable row level security;

create policy "authenticated read/write chart_symbol_overrides" on chart_symbol_overrides
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
