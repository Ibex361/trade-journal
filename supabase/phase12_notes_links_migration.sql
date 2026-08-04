-- ============================================================
-- Trade journal — Phase 12 migration (Notes/diary — Phase 3 part 3)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations (including phase11_notes_tags_migration.sql).
--
-- Adds optional note-to-trade and note-to-strategy linking:
--   - linked_trade_ids: uuid[], references trades a note is about. Plain
--     array of trade ids (not a join table) — same "array column, no
--     separate table" approach tags already use on both trades and notes.
--     No foreign-key constraint on the array elements (Postgres can't
--     express that directly on an array column); the app is the only
--     writer and always sources ids from real fetched trades, and a
--     dangling id from a since-deleted trade is harmless — it's simply
--     filtered out client-side when resolving ids back to trade rows.
--   - linked_strategy: text, matches the *raw* value of a trade's own
--     strategy field (trades.strategy) — there's no separate strategies
--     table in this app (see StrategyLeaderboard, which derives strategies
--     from distinct trades.strategy values), so a note links to a strategy
--     the same way a trade "has" one: by storing that same string value.
-- ============================================================

alter table notes add column linked_trade_ids uuid[] not null default '{}';
alter table notes add column linked_strategy text;

create index notes_linked_trade_ids_idx on notes using gin(linked_trade_ids);
