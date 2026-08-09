-- ============================================================
-- Trade journal — Phase 11 migration (Notes/diary — Phase 3 part 1)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations (including 014_notes_table.sql).
--
-- Adds a tags column to notes, mirroring trades.tags exactly (text[],
-- default '{}'). Tags are NOT a separate notes-only vocabulary — notes
-- reuse the same account-wide "tag" category in dropdown_settings that
-- trades already use (managed in Settings → Tags), so a tag like "FOMO"
-- means the same thing whether it's on a trade or a note.
-- ============================================================

alter table notes add column tags text[] not null default '{}';

create index notes_tags_idx on notes using gin(tags);
