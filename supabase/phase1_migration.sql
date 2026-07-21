-- ============================================================
-- Trade journal — Phase 1 migration
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER schema.sql has already been run.
-- ============================================================

alter table accounts add column is_archived boolean not null default false;
