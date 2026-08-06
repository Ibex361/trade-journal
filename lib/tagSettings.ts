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
