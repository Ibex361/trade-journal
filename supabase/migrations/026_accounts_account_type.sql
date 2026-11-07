-- ============================================================
-- Trade journal — Phase 15 migration (Exness Standard Cent accounts)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations (including 025_backtests.sql).
--
-- Adds accounts.account_type so the app knows how to read an account's
-- numbers (see lib/accountUnits.ts):
--
--   'standard'  lots are standard lots; balance/P&L in the account
--               currency (e.g. USD). Every existing account — the
--               default below — keeps behaving exactly as before.
--   'cent'      Exness Standard Cent: 1 lot = 1/100 of a standard lot,
--               and balance/P&L are in cents (USC, $1 = 100 USC). Money
--               fields are STORED in USC exactly as the broker reports
--               them; trades.size is in true units of the instrument.
--
-- Cent and Standard accounts must be separate journal accounts (the
-- money scale differs by 100x) — one account is exactly one type.
--
-- Changing an existing account's type does NOT rewrite its trades. After
-- switching an account to 'cent', re-import its Exness history (Settings →
-- Import trades → "Update already-imported trades") to correct sizes.
-- ============================================================

alter table accounts
  add column account_type text not null default 'standard'
  check (account_type in ('standard', 'cent'));
