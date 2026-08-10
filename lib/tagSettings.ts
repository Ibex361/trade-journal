import { supabase } from "./supabaseClient";

/**
 * Account-wide tag operations. Originally backed by a curated tag_settings
 * table (a hand-maintained list you added tags to before they'd appear as
 * suggestions) — Part 2 of the freeform-tag work retired that model.
 * Tag suggestions now come from fetchDistinctTags (every tag actually in
 * use, see Part 1), and this "Tag setting" surface in Settings is now
 * purely a rename/delete tool: type an existing tag's name, then rename or
 * delete it everywhere it appears across trades and notes.
 *
 * The tag_settings table itself has been dropped (see
 * supabase/phase13_drop_tag_settings.sql) now that nothing reads or writes
 * it — fetchTagSettings/addTagSetting/deleteTagSetting/reorderTagSetting
 * were removed along with it.
 */

// Only .id/.value are ever read by callers (BulkActionsBar,
// NotesBulkActionsBar) — trimmed down from the old tag_settings row shape
// now that nothing synthesizes the other fields from a real table row.
export type TagSettingItem = {
  id: string;
  value: string;
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

/**
 * Fetches every trade/note id (plus its current tags) on this account whose
 * tags array contains `value` — the shared lookup both rename and delete
 * below build on, so a tag rename/delete acts on every place it's used
 * without the caller needing its own list of trades/notes already fetched.
 */
async function fetchRowsWithTag(
  table: "trades" | "notes",
  accountId: string,
  value: string
): Promise<{ id: string; tags: string[] }[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, tags")
    .eq("account_id", accountId)
    .contains("tags", [value]);
  if (error) console.error(`fetchRowsWithTag (${table}) failed:`, error);
  return (data as { id: string; tags: string[] }[] | null) ?? [];
}

/**
 * Renames a tag everywhere it appears across this account's trades and
 * notes — the "Rename" action on the reshaped Tag setting card (Part 2).
 * Does the id lookup client-side (fetchRowsWithTag, exact-match against the
 * old value — see its docstring) but the actual array rewrite server-side
 * via the bulk_rename_trade_tag/bulk_rename_note_tag RPCs (see
 * migrations/022_bulk_tag_rename_functions.sql) — one UPDATE per table
 * instead of one per row. Previously this issued one UPDATE request per
 * matching trade/note (Promise.all over N individual `.update()` calls),
 * the same N+1 pattern migrations/021_bulk_tag_functions.sql already fixed
 * for the Trades/Notes bulk +tag/-tag actions; renaming a tag used on 300
 * trades meant 300 concurrent requests with no chunking and no atomicity.
 * See 022's header comment for the case-sensitivity note on the RPC path.
 */
export async function renameTagEverywhere(accountId: string, oldValue: string, newValue: string) {
  const [tradeRows, noteRows] = await Promise.all([
    fetchRowsWithTag("trades", accountId, oldValue),
    fetchRowsWithTag("notes", accountId, oldValue),
  ]);

  const results = await Promise.all([
    tradeRows.length > 0
      ? supabase.rpc("bulk_rename_trade_tag", {
          trade_ids: tradeRows.map((r) => r.id),
          tag_from: oldValue,
          tag_to: newValue,
        })
      : null,
    noteRows.length > 0
      ? supabase.rpc("bulk_rename_note_tag", {
          note_ids: noteRows.map((r) => r.id),
          tag_from: oldValue,
          tag_to: newValue,
        })
      : null,
  ]);
  const error = results.find((r) => r?.error)?.error ?? null;
  if (error) console.error("renameTagEverywhere failed:", error);
  return { error, count: tradeRows.length + noteRows.length };
}

/**
 * Removes a tag everywhere it appears across this account's trades and
 * notes — the "Delete" action on the reshaped Tag setting card (Part 2).
 * Same id-lookup-then-bulk-RPC shape as renameTagEverywhere above, but
 * reuses the EXISTING bulk_remove_trade_tag/bulk_remove_note_tag RPCs from
 * migrations/021_bulk_tag_functions.sql — no new SQL needed for delete,
 * since "remove this value from every row's array" is exactly what those
 * already do.
 */
export async function deleteTagEverywhere(accountId: string, value: string) {
  const [tradeRows, noteRows] = await Promise.all([
    fetchRowsWithTag("trades", accountId, value),
    fetchRowsWithTag("notes", accountId, value),
  ]);

  const results = await Promise.all([
    tradeRows.length > 0
      ? supabase.rpc("bulk_remove_trade_tag", { trade_ids: tradeRows.map((r) => r.id), tag_to_remove: value })
      : null,
    noteRows.length > 0
      ? supabase.rpc("bulk_remove_note_tag", { note_ids: noteRows.map((r) => r.id), tag_to_remove: value })
      : null,
  ]);
  const error = results.find((r) => r?.error)?.error ?? null;
  if (error) console.error("deleteTagEverywhere failed:", error);
  return { error, count: tradeRows.length + noteRows.length };
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
