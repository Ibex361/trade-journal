-- ============================================================
-- Phase 16 — Bulk tag rename functions (trades + notes)
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER
-- 021_bulk_tag_functions.sql.
--
-- Efficiency fix: the Settings "Tag setting" card's rename/delete-everywhere
-- actions (lib/tagSettings.ts) fetched every trade/note row carrying the
-- target tag, then issued one UPDATE per row via Promise.all — the exact
-- N+1 pattern 021_bulk_tag_functions.sql already fixed for the Trades/Notes
-- bulk +tag/-tag actions, just never extended to this surface. Renaming a
-- tag used on 300 trades fired 300 concurrent PATCH requests with no
-- chunking, and a request failing partway through left the tag
-- half-renamed.
--
-- deleteTagEverywhere is fixed by calling the EXISTING
-- bulk_remove_trade_tag/bulk_remove_note_tag functions from 021 with the
-- full id list (no new SQL needed for that half — see lib/tagSettings.ts).
-- Rename needs its own function since it's a swap, not a plain removal:
-- old value removed, then new value removed-then-appended (same "ensure
-- tag present exactly once" idiom 021 uses for add), so a row that already
-- separately had tag_to doesn't end up with a duplicate.
--
-- Case sensitivity: exact string match only, same as every array_remove/
-- array_append call in 021 — this was already the case-sensitive
-- convention for the bulk RPC path before this migration. The
-- old renameTagEverywhere/deleteTagEverywhere additionally did a
-- case-INsensitive strip inside apply(), but since fetchRowsWithTag only
-- ever selected rows via Postgres's (case-sensitive) `tags @> [value]`
-- containment check, that case-insensitive step only mattered for the rare
-- case of a single row carrying two different casings of the same tag
-- (e.g. both "Breakout" and "breakout") — deliberately not preserved here
-- as not worth the added SQL complexity for a single-user app; flag if it
-- ever turns out to matter.
--
-- SECURITY INVOKER (the default, stated explicitly here) — same as 021,
-- runs with the calling session's own privileges under existing RLS.
-- ============================================================

create or replace function bulk_rename_trade_tag(trade_ids uuid[], tag_from text, tag_to text)
returns void
language sql
security invoker
as $$
  update trades
  set tags = array_append(array_remove(array_remove(tags, tag_from), tag_to), tag_to)
  where id = any(trade_ids);
$$;

create or replace function bulk_rename_note_tag(note_ids uuid[], tag_from text, tag_to text)
returns void
language sql
security invoker
as $$
  update notes
  set tags = array_append(array_remove(array_remove(tags, tag_from), tag_to), tag_to)
  where id = any(note_ids);
$$;
