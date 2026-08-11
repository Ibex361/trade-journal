-- ============================================================
-- Trade journal — Phase 2b migration (screenshot storage)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER schema.sql and the earlier phase migrations.
--
-- Creates the storage bucket used for trade chart screenshots
-- and opens it up the same way the rest of the app's tables are
-- (public read/write — safe for a personal, single-user app
-- where only you have the project URL and anon key).
-- ============================================================

insert into storage.buckets (id, name, public)
values ('trade-screenshots', 'trade-screenshots', true)
on conflict (id) do nothing;

create policy "public read screenshots"
  on storage.objects for select
  using (bucket_id = 'trade-screenshots');

create policy "public insert screenshots"
  on storage.objects for insert
  with check (bucket_id = 'trade-screenshots');

create policy "public update screenshots"
  on storage.objects for update
  using (bucket_id = 'trade-screenshots');

create policy "public delete screenshots"
  on storage.objects for delete
  using (bucket_id = 'trade-screenshots');
