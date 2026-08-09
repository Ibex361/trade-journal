-- ============================================================
-- Trade journal — Phase 9 migration (ImageKit screenshots)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- New chart screenshots are uploaded to ImageKit instead of
-- Supabase Storage, to stay off Supabase's free-tier 1GB
-- storage / 5GB bandwidth caps. This column stores ImageKit's
-- own file ID, which its API requires to delete a file.
--
-- Existing screenshots stay exactly where they are, in the
-- "trade-screenshots" Supabase Storage bucket — this migration
-- doesn't touch them, and the app still knows how to delete
-- those the old way (they just have no screenshot_file_id).
-- ============================================================

alter table trades add column screenshot_file_id text;
