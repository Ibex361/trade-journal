-- ============================================================
-- Phase 12b (Tag setting, part 2 cleanup) — remove 'tag' from
-- dropdown_settings now that tag_settings is the source of truth
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER
-- 017_tag_settings_table.sql AND after deploying the part 2
-- code changes (TradeFormPanel, NoteEditPanel, trades/notes pages all
-- now read tag suggestions from tag_settings instead of
-- dropdown_settings' 'tag' category — see lib/tagSettings.ts).
--
-- This is safe to run because:
--   1. tag_settings was already backfilled from these rows in part 1.
--   2. No remaining code path reads or writes dropdown_settings rows
--      with category = 'tag' (verified across app/trades/page.tsx,
--      app/notes/page.tsx, components/trades/TradeFormPanel.tsx,
--      components/trades/BulkActionsBar.tsx,
--      components/notes/NoteEditPanel.tsx, and
--      components/settings/DropdownLists.tsx).
-- ============================================================

-- Drop the backfilled 'tag' rows — tag_settings already has this data.
delete from dropdown_settings where category = 'tag';

-- Drop and recreate the category check constraint without 'tag'.
-- The constraint name here is the default Postgres-generated name for a
-- column-level check on dropdown_settings.category; if your database
-- has a different name (e.g. from a manual rename), adjust accordingly.
alter table dropdown_settings drop constraint dropdown_settings_category_check;

alter table dropdown_settings
  add constraint dropdown_settings_category_check
  check (category in ('asset_class', 'strategy', 'session', 'emotion'));
