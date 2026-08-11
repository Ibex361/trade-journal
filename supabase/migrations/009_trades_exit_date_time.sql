-- ============================================================
-- Trade journal — Phase 6 migration (exit date & time)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- Adds optional exit_date and exit_time columns so a trade can
-- record when it was closed, separately from entry_date/entry_time
-- (when it was opened). Nullable and backfills nothing — existing
-- trades simply have no exit date/time until edited. This is also
-- the foundation for a later "performance by holding time" chart;
-- it doesn't add one yet.
-- ============================================================

alter table trades add column exit_date date;
alter table trades add column exit_time time;
