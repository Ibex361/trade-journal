-- ============================================================
-- Trade journal — Phase 7 migration (take profit price)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- Adds an optional take_profit_price column, mirroring
-- stop_loss_price. Nullable and backfills nothing — existing
-- trades simply have no take profit price until edited. Not
-- currently used in any calculation (R-multiple is still risk-
-- based, off stop_loss_price only) — this is just captured for
-- later analysis.
-- ============================================================

alter table trades add column take_profit_price numeric;
