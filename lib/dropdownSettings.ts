import { supabase } from "./supabaseClient";

export type DropdownCategory = "asset_class" | "strategy" | "session" | "emotion" | "tag";

export type DropdownItem = {
  id: string;
  account_id: string;
  category: DropdownCategory;
  value: string;
  sort_order: number;
};

export async function fetchDropdownItems(accountId: string) {
  return supabase
    .from("dropdown_settings")
    .select("*")
    .eq("account_id", accountId)
    .order("sort_order", { ascending: true });
}

export async function addDropdownItem(
  accountId: string,
  category: DropdownCategory,
  value: string,
  sortOrder: number
) {
  return supabase.from("dropdown_settings").insert({
    account_id: accountId,
    category,
    value,
    sort_order: sortOrder,
  });
}

export async function deleteDropdownItem(id: string) {
  return supabase.from("dropdown_settings").delete().eq("id", id);
}

export async function reorderDropdownItem(id: string, newSortOrder: number) {
  return supabase
    .from("dropdown_settings")
    .update({ sort_order: newSortOrder })
    .eq("id", id);
}
