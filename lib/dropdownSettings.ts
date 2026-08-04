import { supabase } from "./supabaseClient";

export type DropdownCategory = "asset_class" | "strategy" | "session" | "emotion" | "tag";

export type DropdownItem = {
  id: string;
  account_id: string;
  category: DropdownCategory;
  value: string;
  sort_order: number;
};

// Starter values for every new account. "tag" is deliberately excluded —
// tags are freeform per-account labels, not a fixed reference list, so a
// new account should start with an empty tag list. Since Notes Phase 3
// part 1, this same "tag" vocabulary is shared by both trades and notes.
export const DEFAULT_DROPDOWN_ITEMS: { category: DropdownCategory; value: string }[] = [
  { category: "asset_class", value: "Forex" },
  { category: "asset_class", value: "Indices" },
  { category: "asset_class", value: "Crypto" },
  { category: "strategy", value: "Breakout" },
  { category: "strategy", value: "Mean reversion" },
  { category: "strategy", value: "Trend following" },
  { category: "session", value: "London" },
  { category: "session", value: "New York" },
  { category: "session", value: "Asia" },
  { category: "emotion", value: "Calm" },
  { category: "emotion", value: "Confident" },
  { category: "emotion", value: "Anxious" },
  { category: "emotion", value: "Impatient" },
];

// Seeds the default dropdown items for a freshly created account. Best-effort:
// if it fails, the account still exists — it just opens with empty lists,
// same as before this feature, rather than blocking account creation.
export async function seedDefaultDropdownItems(accountId: string) {
  const bySortOrder = new Map<DropdownCategory, number>();
  const rows = DEFAULT_DROPDOWN_ITEMS.map(({ category, value }) => {
    const nextOrder = (bySortOrder.get(category) ?? 0) + 1;
    bySortOrder.set(category, nextOrder);
    return {
      account_id: accountId,
      category,
      value,
      sort_order: nextOrder,
    };
  });
  return supabase.from("dropdown_settings").insert(rows);
}

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

/**
 * How many trades/notes on this account currently have this value set, for
 * the given category — used to warn before deleting a dropdown option
 * that's still in use. "tag" is stored as an array column (on both trades
 * and, since Notes Phase 3 part 1, notes too — they share one account-wide
 * tag vocabulary), so it needs a containment check instead of a plain
 * equality match, and for "tag" specifically the count spans both tables.
 */
export async function getDropdownItemUsageCount(
  accountId: string,
  category: DropdownCategory,
  value: string
): Promise<number> {
  let tradesQuery = supabase
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  tradesQuery = category === "tag" ? tradesQuery.contains("tags", [value]) : tradesQuery.eq(category, value);

  const { count: tradesCount, error: tradesError } = await tradesQuery;
  if (tradesError) {
    console.error("getDropdownItemUsageCount (trades) failed:", tradesError);
  }

  if (category !== "tag") {
    return tradesCount ?? 0;
  }

  const { count: notesCount, error: notesError } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId)
    .contains("tags", [value]);
  if (notesError) {
    console.error("getDropdownItemUsageCount (notes) failed:", notesError);
  }

  return (tradesCount ?? 0) + (notesCount ?? 0);
}

export async function reorderDropdownItem(id: string, newSortOrder: number) {
  return supabase
    .from("dropdown_settings")
    .update({ sort_order: newSortOrder })
    .eq("id", id);
}
