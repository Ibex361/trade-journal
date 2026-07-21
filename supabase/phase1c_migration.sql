-- ============================================================
-- Trade journal — Phase 1c migration
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER phase1b_migration.sql has already been run.
--
-- Replaces the "active accounts only" uniqueness rule with a
-- global one: no two accounts may share a name (case-insensitive),
-- whether archived or not.
--
-- Note: if this fails with a "could not create unique index"
-- error, it means two of your existing accounts (possibly one
-- archived) already share a name — rename one of them first,
-- then re-run this migration.
-- ============================================================

drop index if exists accounts_active_name_unique;

create unique index accounts_name_unique
  on accounts (lower(name));
