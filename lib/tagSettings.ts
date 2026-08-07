import { supabase } from "./supabaseClient";

/**
 * Dedicated account-wide tag vocabulary, decoupled from the generic
 * dropdown_settings category system (see phase12_tag_settings_migration.sql).
 * This is the "Tag setting" surface in Settings — separate from the
 * asset_class/strategy/session/emotion dropdown lists.
 *
 * Part 1: this module + the Settings management UI, backed by the new
 * tag_settings table (backfilled from the old dropdown_settings 'tag' rows).
 * Part 2 will point TradeFormPanel/NoteEditPanel/the filter bars here
 * instead of dropdown_settings, then safely drop the old 'tag' category.
 */

export type TagSettingItem = {
  id: string;
  account_id: string;
  value: string;
  sort_order: number;
  created_at: string;
};

/**
 * Every distinct tag currently in use on this account, across both trades
 * and notes — the actual autocomplete source (Part 1 of the freeform-tag
 * suggestion fix): previously TagInput's `suggestions` only offered the
 * curated tag_settings list, so a tag typed freeform onto a trade/note but
 * never separately added in Settings would never show up as a suggestion
 * again. Selects just the tags column from both tables (not a head-count)
 * since the values themselves are what's needed here.
 */
export async function fetchDistinctTags(accountId: string): Promise<string[]> {
  const [tradesResult, notesResult] = await Promise.all([
    supabase.from("trades").select("tags").eq("account_id", accountId),
    supabase.from("notes").select("tags").eq("account_id", accountId),
  ]);
  if (tradesResult.error) console.error("fetchDistinctTags (trades) failed:", tradesResult.error);
  if (notesResult.error) console.error("fetchDistinctTags (notes) failed:", notesResult.error);

  const seen = new Map<string, string>(); // lowercase -> first-seen casing
  for (const row of [...(tradesResult.data ?? []), ...(notesResult.data ?? [])]) {
    for (const tag of (row as { tags: string[] | null }).tags ?? []) {
      const key = tag.toLowerCase();
      if (!seen.has(key)) seen.set(key, tag);
    }
  }
  return Array.from(seen.values()).sort((a, b) => a.localeCompare(b));
}

export async function fetchTagSettings(accountId: string) {
  return supabase
    .from("tag_settings")
    .select("*")
    .eq("account_id", accountId)
    .order("sort_order", { ascending: true });
}

export async function addTagSetting(accountId: string, value: string, sortOrder: number) {
  return supabase.from("tag_settings").insert({
    account_id: accountId,
    value,
    sort_order: sortOrder,
  });
}

export async function deleteTagSetting(id: string) {
  return supabase.from("tag_settings").delete().eq("id", id);
}

export async function reorderTagSetting(id: string, newSortOrder: number) {
  return supabase.from("tag_settings").update({ sort_order: newSortOrder }).eq("id", id);
}

/**
 * How many trades/notes on this account currently carry this tag value —
 * used to warn before deleting a tag that's still in use. Same containment
 * check as dropdownSettings.getDropdownItemUsageCount used for the 'tag'
 * category, since tags are stored as a text[] column on both tables.
 */
export async function getTagUsageCount(accountId: string, value: string): Promise<number> {
  const { count: tradesCount, error: tradesError } = await supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .contains("tags", [value]);
  if (tradesError) {
    console.error("getTagUsageCount (trades) failed:", tradesError);
  }

  const { count: notesCount, error: notesError } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .contains("tags", [value]);
  if (notesError) {
    console.error("getTagUsageCount (notes) failed:", notesError);
  }

  return (tradesCount ?? 0) + (notesCount ?? 0);
}
