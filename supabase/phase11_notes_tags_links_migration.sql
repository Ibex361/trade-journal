-- ============================================================
-- Trade journal — Phase 11 (Notes Phase 3: tags + optional links)
-- Run in Supabase SQL editor AFTER phase10_notes_migration.sql.
-- ============================================================

alter table notes
  add column if not exists tags text[] not null default '{}',
  add column if not exists linked_trade_id uuid references trades(id) on delete set null,
  add column if not exists linked_strategy text;

create index if not exists notes_tags_gin on notes using gin (tags);
create index if not exists notes_linked_trade_idx on notes (linked_trade_id) where linked_trade_id is not null;
