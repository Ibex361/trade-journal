import { supabase } from "./supabaseClient";

/**
 * Account-wide overrides for Exness contract sizes — lets the user type any
 * symbol and set the contract size used to convert that symbol's imported
 * "lots" into the app's "units" size convention (see contractSizeFor in
 * exnessContractSize.ts). This is a small, deliberately un-curated list:
 * there's no dropdown of every possible instrument (that would clutter the
 * settings page) — you type a symbol's name, and either edit an existing
 * override or create a new one. An override here takes priority over the
 * built-in lookup table for that symbol on that account; it doesn't touch
 * or replace the table itself.
 *
 * Symbols are stored uppercased (matching how contractSizeFor normalizes
 * its own lookups) so "xauusd" and "XAUUSD" are always the same override.
 */

export type ContractSizeOverride = {
  id: string;
  symbol: string;
  contract_size: number;
};

/**
 * Every contract-size override currently saved on this account, as a
 * symbol -> size map — the shape contractSizeFor's optional overrides
 * argument expects, and the shape the settings card's autocomplete
 * suggests from.
 */
export async function fetchContractSizeOverrides(accountId: string): Promise<Map<string, number>> {
  const { data, error } = await supabase
    .from("exness_contract_overrides")
    .select("symbol, contract_size")
    .eq("account_id", accountId);
  if (error) {
    console.error("fetchContractSizeOverrides failed:", error);
    return new Map();
  }
  return new Map((data ?? []).map((row) => [row.symbol, row.contract_size as number]));
}

/**
 * Same data as fetchContractSizeOverrides, but as a sorted list with row
 * ids — what the settings card renders and edits directly, rather than the
 * plain map the CSV parser consumes.
 */
export async function fetchContractSizeOverrideList(accountId: string): Promise<ContractSizeOverride[]> {
  const { data, error } = await supabase
    .from("exness_contract_overrides")
    .select("id, symbol, contract_size")
    .eq("account_id", accountId)
    .order("symbol", { ascending: true });
  if (error) {
    console.error("fetchContractSizeOverrideList failed:", error);
    return [];
  }
  return (data ?? []) as ContractSizeOverride[];
}

/**
 * Creates or updates the override for a symbol on this account (upsert on
 * the account_id+symbol unique constraint) — a single "type a symbol, set
 * its size" action covers both adding a brand-new override and editing an
 * existing one, matching how the settings card doesn't distinguish the two
 * up front.
 */
export async function upsertContractSizeOverride(accountId: string, symbol: string, contractSize: number) {
  const normalized = symbol.trim().toUpperCase();
  const { error } = await supabase
    .from("exness_contract_overrides")
    .upsert(
      { account_id: accountId, symbol: normalized, contract_size: contractSize, updated_at: new Date().toISOString() },
      { onConflict: "account_id,symbol" }
    );
  if (error) console.error("upsertContractSizeOverride failed:", error);
  return { error };
}

/**
 * Removes a symbol's override entirely, reverting that symbol to whatever
 * the built-in lookup table (or its size-1 fallback) resolves it to.
 */
export async function deleteContractSizeOverride(accountId: string, symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  const { error } = await supabase
    .from("exness_contract_overrides")
    .delete()
    .eq("account_id", accountId)
    .eq("symbol", normalized);
  if (error) console.error("deleteContractSizeOverride failed:", error);
  return { error };
}
