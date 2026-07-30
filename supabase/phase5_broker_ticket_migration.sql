-- ============================================================
-- Trade journal — Phase 5 migration (broker ticket / import dedupe)
-- Run this in the Supabase SQL editor as a NEW query,
-- AFTER all earlier migrations.
--
-- Adds an optional broker_ticket column that stores a broker's own trade
-- ID (e.g. Exness' "ticket" number) when a trade came in through a broker
-- CSV import. This is what lets a re-import of an overlapping date range
-- skip trades that are already in the journal instead of duplicating them.
-- Nullable — manually-entered trades simply have no ticket.
-- ============================================================

alter table trades add column broker_ticket text;

-- Speeds up the "which of these tickets do I already have?" existence
-- check an import runs before inserting.
create index if not exists trades_broker_ticket_idx on trades(account_id, broker_ticket);
