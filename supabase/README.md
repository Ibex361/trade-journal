# Database migrations

Migrations run manually: copy each file's SQL into the Supabase dashboard's
SQL editor, in numeric order, as a new query. There is no Supabase CLI in
use on this project (no `supabase/config.toml`), so nothing tracks applied
state automatically — the numbered filenames in `migrations/` are the only
record of order and history.

- `migrations/000` through `020` — run once, in order, already applied to
  the live "Trade Journal v2" project.
- `schema_snapshot.sql` — current-state reference only, regenerated live
  from the database. Never run this file — it's for reading, not applying.
  Regenerate it after any future schema change.

New migrations: add the next-numbered file to `migrations/`, run it by hand
in the SQL editor, then regenerate `schema_snapshot.sql` to match.
