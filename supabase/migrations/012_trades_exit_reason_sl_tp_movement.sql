-- ============================================================
-- Trade journal — Phase 8 migration (exit reason, SL/TP movement)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- Adds three optional, structured fields:
--   - exit_reason: why the trade closed (stop loss hit, take
--     profit hit, closed manually, other). Nullable, backfills
--     nothing existing.
--   - sl_movement / tp_movement: whether the stop loss / take
--     profit was held as originally set, tightened, or widened
--     during the trade. Nullable — leave unset for trades where
--     this wasn't tracked or no stop/TP was set at all.
-- All three are check-constrained the same way `direction` is,
-- to keep the values consistent for later analysis.
-- ============================================================

alter table trades add column exit_reason text
  check (exit_reason in ('stop_loss', 'take_profit', 'manual', 'other'));

alter table trades add column sl_movement text
  check (sl_movement in ('held', 'tightened', 'widened'));

alter table trades add column tp_movement text
  check (tp_movement in ('held', 'tightened', 'widened'));
