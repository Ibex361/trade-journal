-- ============================================================
-- Phase 15 — Bulk tag add/remove functions (trades + notes)
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER all earlier
-- migrations (including 020_exness_contract_overrides.sql).
--
-- Efficiency fix: the Trades and Notes pages' bulk "+ tag"/"- tag" actions
-- previously issued one UPDATE request per selected row (Promise.all over
-- updateTradeTags/updateNoteTags, one Supabase round-trip each) because
-- each row needs its *own* tags array recomputed — unlike bulk delete
-- (already a single `.in("id", ids)` call) or bulk "set rules followed"
-- (a single value applied to every row, doesn't need this). These four
-- functions do the per-row array recomputation inside one UPDATE statement
-- server-side instead, so selecting e.g. 200 rows and tagging them is one
-- request, not 200.
--
-- SECURITY INVOKER (the default, stated explicitly here) — these functions
-- run with the calling session's own privileges, so the existing
-- "authenticated read/write trades"/"authenticated read/write notes" RLS
-- policies still apply exactly as they do for a plain client-side update;
-- nothing here bypasses or widens access.
--
-- array_append(array_remove(tags, tag), tag) is the "ensure tag present
-- exactly once" idiom: removing first means a row that (for whatever
-- reason) already had a duplicate gets de-duplicated as a side effect,
-- and it's a no-op if the tag isn't there yet, then appends it once.
-- array_remove alone drops all matching occurrences for the remove case.
-- ============================================================

create or replace function bulk_add_trade_tag(trade_ids uuid[], tag_to_add text)
returns void
language sql
security invoker
as $$
  update trades
  set tags = array_append(array_remove(tags, tag_to_add), tag_to_add)
  where id = any(trade_ids);
$$;

create or replace function bulk_remove_trade_tag(trade_ids uuid[], tag_to_remove text)
returns void
language sql
security invoker
as $$
  update trades
  set tags = array_remove(tags, tag_to_remove)
  where id = any(trade_ids);
$$;

create or replace function bulk_add_note_tag(note_ids uuid[], tag_to_add text)
returns void
language sql
security invoker
as $$
  update notes
  set tags = array_append(array_remove(tags, tag_to_add), tag_to_add)
  where id = any(note_ids);
$$;

create or replace function bulk_remove_note_tag(note_ids uuid[], tag_to_remove text)
returns void
language sql
security invoker
as $$
  update notes
  set tags = array_remove(tags, tag_to_remove)
  where id = any(note_ids);
$$;
