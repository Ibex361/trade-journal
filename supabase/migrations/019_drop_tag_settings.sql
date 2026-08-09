-- ============================================================
-- Phase 13 — drop the orphaned tag_settings table
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER
-- deploying the code changes that remove all references to
-- tag_settings (fetchTagSettings/addTagSetting/deleteTagSetting/
-- reorderTagSetting removed from lib/tagSettings.ts).
--
-- Context: Phase 12/12b built tag_settings as a curated,
-- hand-maintained tag vocabulary. The Tag setting rework (see
-- lib/tagSettings.ts) retired that model — tag suggestions now
-- come from fetchDistinctTags (every tag actually in use across
-- trades/notes), and the "Tag setting" UI in Settings became a
-- pure rename/delete-by-typed-name tool operating directly on
-- trades/notes rows. Nothing has read or written tag_settings
-- since that change, so it's safe to drop.
-- ============================================================

drop table if exists tag_settings;
