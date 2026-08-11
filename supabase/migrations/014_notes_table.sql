-- ============================================================
-- Trade journal — Phase 10 migration (Notes/diary — Phase 1a)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- Foundation table for the notes/diary feature. Content is stored as
-- Tiptap's own JSON document format (jsonb), not HTML or markdown — that's
-- what the editor reads from and writes back to directly, no conversion
-- step needed. `title` is kept as a separate plain-text column (rather than
-- just the first line of the document) so a notes list can show/sort by it
-- cheaply without parsing the document body.
--
-- Same RLS shape as every other table since Phase 3 (trades, accounts,
-- dropdown_settings): open to any authenticated session, no per-row
-- ownership, because this is a single-user app gated by Supabase Auth.
-- ============================================================

create table notes (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  title text not null default 'Untitled',
  content jsonb not null default '{"type":"doc","content":[{"type":"paragraph"}]}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notes_account_idx on notes(account_id);
create index notes_updated_idx on notes(account_id, updated_at desc);

alter table notes enable row level security;

create policy "authenticated read/write notes" on notes
  for all
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');
