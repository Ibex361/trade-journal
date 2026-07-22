-- ============================================================
-- Trade journal — Phase 2c migration
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER phase2b_storage_migration.sql has already been run.
--
-- Backfills the standard asset class / strategy / session / emotion
-- options onto every EXISTING account that doesn't already have them,
-- matching what new accounts now get automatically at creation time
-- (see lib/dropdownSettings.ts -> seedDefaultDropdownItems).
--
-- Safe to re-run: for each account, a category is only seeded if that
-- account currently has ZERO items in it, so accounts that already
-- customized a list (or already have the defaults, e.g. the demo
-- account) are left untouched. Tags are intentionally never seeded —
-- they're freeform per-account labels, not a fixed reference list.
-- ============================================================

with defaults (category, value, sort_order) as (
  values
    ('asset_class', 'Forex', 1),
    ('asset_class', 'Indices', 2),
    ('asset_class', 'Crypto', 3),
    ('strategy', 'Breakout', 1),
    ('strategy', 'Mean reversion', 2),
    ('strategy', 'Trend following', 3),
    ('session', 'London', 1),
    ('session', 'New York', 2),
    ('session', 'Asia', 3),
    ('emotion', 'Calm', 1),
    ('emotion', 'Confident', 2),
    ('emotion', 'Anxious', 3),
    ('emotion', 'Impatient', 4)
)
insert into dropdown_settings (account_id, category, value, sort_order)
select a.id, d.category, d.value, d.sort_order
from accounts a
cross join defaults d
where not exists (
  select 1 from dropdown_settings ds
  where ds.account_id = a.id
    and ds.category = d.category
);
