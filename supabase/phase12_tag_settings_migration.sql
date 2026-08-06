-- ============================================================
-- Phase 12 (Tag setting, part 1) — dedicated tag_settings table
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER all earlier
-- migrations (including phase11_notes_tags_migration.sql).
--
-- This is the first step of decoupling tag management from the generic
-- dropdown_settings category system. It creates a dedicated tag_settings
-- table, scoped per account like dropdown_settings, and backfills it with
-- whatever tag values already exist in dropdown_settings so nothing is
-- lost. The old 'tag' rows in dropdown_settings are NOT touched or removed
-- by this migration — TradeFormPanel/NoteEditPanel/the filter bars still
-- read from dropdown_settings for now. That switch-over, and the safe
-- removal of 'tag' from dropdown_settings, happens in part 2.
-- ============================================================

create table tag_settings (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  value text not null,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  unique (account_id, value)
);

create index tag_settings_account_idx on tag_settings(account_id);

alter table tag_settings enable row level security;

create policy "authenticated read/write tag_settings" on tag_settings
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- Backfill: copy every existing dropdown_settings 'tag' row into
-- tag_settings, per account, preserving sort_order. ON CONFLICT DO NOTHING
-- makes this safe to re-run.
insert into tag_settings (account_id, value, sort_order)
select account_id, value, sort_order
from dropdown_settings
where category = 'tag'
on conflict (account_id, value) do nothing;
