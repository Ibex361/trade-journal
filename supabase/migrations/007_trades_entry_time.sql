-- ============================================================
-- Trade journal — Phase 4 migration (time of day)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- Adds an optional entry_time column so a trade can record the
-- clock time it was taken (24-hour "HH:MM"), not just the date.
-- Nullable and backfills nothing — existing trades simply have no
-- time until edited. This is the foundation for a later
-- "performance by time of day" chart; it doesn't add one yet.
-- ============================================================

alter table trades add column entry_time time;
