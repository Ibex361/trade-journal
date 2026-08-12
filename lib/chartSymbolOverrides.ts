import { supabase } from "./supabaseClient";

/**
 * Account-wide overrides for the instrument -> Twelve Data symbol mapping
 * (see resolveChartSymbol in chartSymbolMap.ts). Same shape and reasoning
 * as exness_contract_overrides: a small, deliberately un-curated list —
 * type a symbol you trade, set the Twelve Data symbol it should chart
 * against, and that overrides (or adds to, if it's not in the built-in
 * table at all) the app's built-in mapping for that symbol on this
 * account. Needed because this app's instrument symbols are freeform
 * (see lib/trades.ts — `instrument` isn't a closed enum) and Twelve
 * Data's own symbol format varies by asset class in ways that can't
 * always be derived automatically (indices especially — see
 * chartSymbolMap.ts's comment on why those are hand-listed rather than
 * pattern-matched).
 *
 * Symbols are stored uppercased (matching how resolveChartSymbol
 * normalizes its own lookups) so "xauusd" and "XAUUSD" are always the
 * same override. The Twelve Data symbol itself is stored as typed (not
 * uppercased) since Twelve Data symbols are case-sensitive for some
 * asset classes.
 */

export type ChartSymbolOverride = {
  id: string;
  symbol: string;
  twelve_data_symbol: string;
};

/**
 * Every chart symbol override currently saved on this account, as a
 * symbol -> Twelve Data symbol map — the shape resolveChartSymbol's
 * optional overrides argument expects.
 */
export async function fetchChartSymbolOverrides(accountId: string): Promise<Map<string, string>> {
  const { data, error } = await supabase
    .from("chart_symbol_overrides")
    .select("symbol, twelve_data_symbol")
    .eq("account_id", accountId);
  if (error) {
    console.error("fetchChartSymbolOverrides failed:", error);
    return new Map();
  }
  return new Map((data ?? []).map((row) => [row.symbol as string, row.twelve_data_symbol as string]));
}

/**
 * Same data as fetchChartSymbolOverrides, but as a sorted list with row
 * ids — what the settings card renders and edits directly.
 */
export async function fetchChartSymbolOverrideList(accountId: string): Promise<ChartSymbolOverride[]> {
  const { data, error } = await supabase
    .from("chart_symbol_overrides")
    .select("id, symbol, twelve_data_symbol")
    .eq("account_id", accountId)
    .order("symbol", { ascending: true });
  if (error) {
    console.error("fetchChartSymbolOverrideList failed:", error);
    return [];
  }
  return (data ?? []) as ChartSymbolOverride[];
}

/**
 * Creates or updates the override for a symbol on this account (upsert on
 * the account_id+symbol unique constraint) — one action covers both
 * adding a brand-new override and editing an existing one.
 */
export async function upsertChartSymbolOverride(accountId: string, symbol: string, twelveDataSymbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const { error } = await supabase
    .from("chart_symbol_overrides")
    .upsert(
      {
        account_id: accountId,
        symbol: normalized,
        twelve_data_symbol: twelveDataSymbol.trim(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "account_id,symbol" }
    );
  if (error) console.error("upsertChartSymbolOverride failed:", error);
  return { error };
}

/**
 * Removes a symbol's override entirely, reverting that symbol to whatever
 * the built-in mapping table (or "no mapping") resolves it to.
 */
export async function deleteChartSymbolOverride(accountId: string, symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const { error } = await supabase
    .from("chart_symbol_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("symbol", normalized);
  if (error) console.error("deleteChartSymbolOverride failed:", error);
  return { error };
}
