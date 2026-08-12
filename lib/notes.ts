import { supabase } from "./supabaseClient";
import type { JSONContent } from "@tiptap/react";
// hashNote only needs title+content strings — no runtime dependency back
// on this file's exports (notesImport.ts's own import of NoteInput from
// here is type-only and erased), so this is a plain one-way import, not a
// circular one.
import { hashNote } from "./notesImport";

export type Note = {
  id: string;
  account_id: string;
  title: string;
  content: JSONContent;
  tags: string[];
  // Phase 3 part 3: optional linking. linked_trade_ids is a plain array of
  // trade ids (no join table, no FK — see phase12 migration comment);
  // linked_strategy stores the same raw string a trade's own `strategy`
  // field would hold, since there's no separate strategies table anywhere
  // in this app.
  linked_trade_ids: string[];
  linked_strategy: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Shape for a note coming from an import file (see lib/notesImport.ts) —
 * everything createNotes needs to insert a row, including created_at/
 * updated_at, which a freshly-composed note in the editor never supplies
 * itself (those are always server/now-assigned for hand-authored notes).
 */
export type NoteInput = {
  title: string;
  content: JSONContent;
  tags: string[];
  linked_trade_ids: string[];
  linked_strategy: string | null;
  created_at: string;
  updated_at: string;
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

/**
 * Auto-generated title for a new note created from a trade's "Diary"
 * button — e.g. "EURUSD win, Aug 9". Uses the trade's own entry_date
 * (not "today") since a diary entry is conceptually about the trade,
 * which may well be opened days after it happened. Mirrors the win/loss
 * convention used everywhere else (pnl > 0 win, pnl < 0 loss — see
 * lib/metrics/pnl.ts's summarizeTrades) and adds "breakeven" for the
 * pnl === 0 edge case, which those aggregate stats don't need a label
 * for but a single trade's title does.
 */
export function autoTitleFromTrade(instrument: string, pnl: number, entryDate: string): string {
  const outcome = pnl > 0 ? "win" : pnl < 0 ? "loss" : "breakeven";
  const date = new Date(entryDate + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
  return `${instrument} ${outcome}, ${date}`;
}

/**
 * Auto-generated title for a new note created with no trade link (the
 * plain "New note" button/FAB) — e.g. "Aug 9, 2026 — 3:42 PM". Uses the
 * current moment, since there's no other anchor to name the note from.
 */
export function autoTitleFromNow(): string {
  const now = new Date();
  const date = now.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  const time = now.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${date} — ${time}`;
}

/**
 * Newest-first by updated_at, matching the "most recently touched note
 * first" ordering a diary/notes list should have (as opposed to trades,
 * which sort by when the trade happened).
 */
export async function fetchNotes(accountId: string) {
  return supabase
    .from("notes")
    .select("*")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false });
}

/**
 * Phase 1b's create-note flow: inserts a blank note and returns the new
 * row so the caller can navigate straight into it.
 *
 * `linkedTradeIds` (added for the "open/create diary from a trade" flow —
 * see findNoteLinkedToTrade below) lets a note be created already linked
 * to a trade, so the note that opens in the Notes page after redirecting
 * from Trades is the same one the link check will find next time. Defaults
 * to none for the plain "New note" button on the Notes page itself.
 *
 * `title` defaults to autoTitleFromNow() rather than a static "Untitled" —
 * callers that have a trade to link (see autoTitleFromTrade above) should
 * pass a title computed from it instead. Either way the note is fully
 * editable afterward; this only sets what a brand-new note starts out
 * named.
 */
export async function createNote(
  accountId: string,
  linkedTradeIds: string[] = [],
  title: string = autoTitleFromNow()
) {
  const result = await supabase
    .from("notes")
    .insert({ account_id: accountId, title, content: EMPTY_DOC, linked_trade_ids: linkedTradeIds })
    .select()
    .single();
  if (result.error) console.error("createNote failed:", result.error);
  return result;
}

/**
 * Bulk insert for the notes import flow (Settings → Import notes) —
 * mirrors createTrades' chunking (200 rows/request, Supabase's practical
 * payload-size comfort zone for a single insert). Unlike createNote/
 * createTrade, this restores created_at/updated_at from the input rather
 * than letting Postgres default them to now(): imported notes are a
 * backup/restore or account-to-account copy, and re-stamping "now" would
 * both scramble the notes list's updated_at-desc ordering and lose the
 * diary's actual timeline. linked_trade_ids is expected to already be
 * filtered to ids that exist in this account by the caller (see
 * getExistingTradeIds) — this function inserts whatever it's given as-is.
 */
export async function createNotes(accountId: string, inputs: NoteInput[]) {
  const CHUNK_SIZE = 200;
  let inserted = 0;
  for (let i = 0; i < inputs.length; i += CHUNK_SIZE) {
    const chunk = inputs.slice(i, i + CHUNK_SIZE).map((input) => ({
      account_id: accountId,
      title: input.title,
      content: input.content,
      tags: input.tags,
      linked_trade_ids: input.linked_trade_ids,
      linked_strategy: input.linked_strategy,
      created_at: input.created_at,
      updated_at: input.updated_at,
    }));
    const result = await supabase.from("notes").insert(chunk);
    if (result.error) {
      console.error("createNotes failed:", result.error);
      return { inserted, error: result.error };
    }
    inserted += chunk.length;
  }
  return { inserted, error: null };
}

/**
 * Fingerprints (see hashNote in lib/notesImport.ts) of every existing note
 * in the account, for the import flow's duplicate check — only title+content
 * are fetched, not the full row, since that's all a fingerprint needs and
 * note bodies can run to several KB each.
 */
export async function getExistingNoteHashes(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("notes").select("title, content").eq("account_id", accountId);
  if (error) {
    console.error("getExistingNoteHashes failed:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => hashNote(r.title, r.content as JSONContent)));
}

/**
 * Trade ids that exist in this account, for the notes import flow — a
 * note's linked_trade_ids from an export are only meaningful within the
 * account they were created in (see notesImport.ts); importing into a
 * different account needs this to drop links that don't resolve rather
 * than importing a dangling reference.
 */
export async function getExistingTradeIds(accountId: string): Promise<Set<string>> {
  const { data, error } = await supabase.from("trades").select("id").eq("account_id", accountId);
  if (error) {
    console.error("getExistingTradeIds failed:", error);
    return new Set();
  }
  return new Set((data ?? []).map((r) => r.id as string));
}

/**
 * Finds the note (if any) already linked to a given trade, for the Trades
 * page's "open diary entry" action — at most one note is meant to exist
 * per trade (a convention the create-flow enforces by checking here
 * first, not a DB constraint: linked_trade_ids is a general-purpose array,
 * nothing stops it holding more than one trade per note or a trade
 * appearing on two notes if edited directly in the Notes page's own
 * picker). `.contains` performs the array `@>` containment check, so this
 * matches any note whose linked_trade_ids includes tradeId regardless of
 * what else is linked on it.
 */
export async function findNoteLinkedToTrade(accountId: string, tradeId: string) {
  return supabase
    .from("notes")
    .select("*")
    .eq("account_id", accountId)
    .contains("linked_trade_ids", [tradeId])
    .limit(1)
    .maybeSingle();
}

/**
 * Phase 1c: persists title/content edits for an existing note. Phase 3
 * part 1 added tags to what gets saved; Phase 3 part 3 adds the optional
 * trade/strategy links. The notes table has no updated_at trigger (unlike
 * trades, which doesn't track this at all), so updated_at is set
 * explicitly here rather than relying on the DB — this is also what the
 * notes list sorts by, so it has to actually change on every save for the
 * list ordering to make sense.
 */
export async function updateNote(
  id: string,
  title: string,
  content: JSONContent,
  tags: string[],
  linkedTradeIds: string[],
  linkedStrategy: string | null
) {
  const result = await supabase
    .from("notes")
    .update({
      title,
      content,
      tags,
      linked_trade_ids: linkedTradeIds,
      linked_strategy: linkedStrategy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();
  if (result.error) console.error("updateNote failed:", result.error);
  return result;
}

/** Phase 1c part 2 — used by the notes list's delete confirmation flow. */
export async function deleteNote(id: string) {
  const result = await supabase.from("notes").delete().eq("id", id);
  if (result.error) console.error("deleteNote failed:", result.error);
  return result;
}

/** Deletes multiple notes in a single request — used by the Notes page's bulk-delete action. */
export async function deleteNotes(ids: string[]) {
  const result = await supabase.from("notes").delete().in("id", ids);
  if (result.error) console.error("deleteNotes failed:", result.error);
  return result;
}

/**
 * Bulk "+ tag"/"- tag" actions — one Postgres round-trip for the whole
 * selection instead of one per-row `.update()` call, mirroring
 * bulkAddTradeTag/bulkRemoveTradeTag in lib/trades.ts (each row needs its
 * own tags array recomputed, so this can't be a single plain `.update()`
 * the way `deleteNotes` can; see migrations/021_bulk_tag_functions.sql for
 * the server-side array_append/array_remove logic these call into).
 */
export async function bulkAddNoteTag(ids: string[], tag: string) {
  const result = await supabase.rpc("bulk_add_note_tag", { note_ids: ids, tag_to_add: tag });
  if (result.error) console.error("bulkAddNoteTag failed:", result.error);
  return result;
}

export async function bulkRemoveNoteTag(ids: string[], tag: string) {
  const result = await supabase.rpc("bulk_remove_note_tag", { note_ids: ids, tag_to_remove: tag });
  if (result.error) console.error("bulkRemoveNoteTag failed:", result.error);
  return result;
}

/**
 * Walks a Tiptap JSON document and concatenates every text node into one
 * plain-text string, with no length cap — used where the full body matters
 * (Phase 3 part 2's search), as opposed to extractPreviewText's truncated
 * list-card snippet below. Kept as the shared "how do we get plain text out
 * of a Tiptap doc" primitive so the list preview and search stay in sync
 * with each other whenever the editor's node shape changes.
 */
export function extractFullText(content: JSONContent): string {
  const parts: string[] = [];

  function walk(node: JSONContent) {
    if (typeof node.text === "string") parts.push(node.text);
    node.content?.forEach(walk);
  }

  walk(content);
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Truncated plain-text preview snippet for the notes list — the list
 * shouldn't have to know anything about Tiptap's node shape beyond what
 * extractFullText already handles.
 */
export function extractPreviewText(content: JSONContent, maxLen = 140): string {
  const full = extractFullText(content);
  return full.length > maxLen ? `${full.slice(0, maxLen).trimEnd()}…` : full;
}

/**
 * Distinct strategies currently in use across a set of notes, for populating
 * the Strategy filter dropdown — only strategies that actually appear on a
 * note, not every strategy that exists elsewhere in the app.
 */
export function getUsedStrategies(notes: Note[]): string[] {
  const set = new Set<string>();
  for (const n of notes) {
    if (n.linked_strategy) set.add(n.linked_strategy);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}
