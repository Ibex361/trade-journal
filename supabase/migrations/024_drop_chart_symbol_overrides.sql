-- ============================================================
-- Drop chart_symbol_overrides — obsoleted by the R2 candle pipeline
-- ============================================================
-- Run this in the Supabase SQL editor as a NEW query, AFTER
-- 023_chart_symbol_overrides.sql.
--
-- 023 added chart_symbol_overrides to let a user remap an instrument
-- symbol to a Twelve Data symbol for the live-API-backed chart feature.
-- That feature has been replaced by a pre-computed pipeline (Exness
-- tick archive -> Cloudflare R2, see scripts/sync-candles.ts) that
-- reads candles keyed by this app's own instrument string directly —
-- there is no third-party provider symbol to map to anymore, so this
-- table (and its settings card, ChartSymbolCard.tsx, and the
-- lib/chartSymbolMap.ts / lib/chartSymbolOverrides.ts code that used
-- it) no longer serve a purpose.
-- ============================================================

drop table if exists chart_symbol_overrides;
