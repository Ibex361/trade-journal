-- ============================================================
-- Trade journal — Phase 3 migration (real login system)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- The app used to rely on Basic Auth (a username/password gate on the
-- Vercel deployment) while every database table stayed wide open to
-- anyone holding the public anon key. This migration closes that gap:
-- now the database itself requires a logged-in Supabase user, so the
-- anon key alone is no longer enough to read or write your trade data —
-- only a signed-in session (via the new /login page) can.
-- ============================================================

-- --- accounts ---
drop policy if exists "public read/write accounts" on accounts;
create policy "authenticated read/write accounts" on accounts
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- --- dropdown_settings ---
drop policy if exists "public read/write dropdown_settings" on dropdown_settings;
create policy "authenticated read/write dropdown_settings" on dropdown_settings
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- --- trades ---
drop policy if exists "public read/write trades" on trades;
create policy "authenticated read/write trades" on trades
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

-- --- trade-screenshots storage bucket ---
-- Reads stay public: screenshots are displayed via plain public image URLs
-- (<img src="...">), which can't send an auth header, and the bucket
-- itself is already marked "public" so unauthenticated reads of a known
-- URL aren't stoppable at the RLS layer anyway. Writes (upload/replace/
-- delete) now require a logged-in session.
drop policy if exists "public insert screenshots" on storage.objects;
drop policy if exists "public update screenshots" on storage.objects;
drop policy if exists "public delete screenshots" on storage.objects;

create policy "authenticated insert screenshots"
  on storage.objects for insert
  with check (bucket_id = 'trade-screenshots' and auth.role() = 'authenticated');

create policy "authenticated update screenshots"
  on storage.objects for update
  using (bucket_id = 'trade-screenshots' and auth.role() = 'authenticated');

create policy "authenticated delete screenshots"
  on storage.objects for delete
  using (bucket_id = 'trade-screenshots' and auth.role() = 'authenticated');
