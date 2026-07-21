-- ============================================================
-- Trade journal — Phase 1b migration
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER schema.sql and phase1_migration.sql have already been run.
--
-- Prevents two ACTIVE (non-archived) accounts from sharing the
-- same name (case-insensitive, e.g. "Main" and "main" both blocked).
-- Archived accounts are excluded, so a name can be reused once
-- the old account holding it is archived.
-- ============================================================

create unique index accounts_active_name_unique
  on accounts (lower(name))
  where not is_archived;
