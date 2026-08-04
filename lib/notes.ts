import { supabase } from "./supabaseClient";
import type { JSONContent } from "@tiptap/react";

export type Note = {
  id: string;
  account_id: string;
  title: string;
  content: JSONContent;
  tags: string[];
  created_at: string;
  updated_at: string;
};

const EMPTY_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

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
 * row so the caller can navigate straight into it. Title/content default
 * to the same values the phase10 migration gives the column, kept explicit
 * here rather than relying on the DB default so the returned row is
 * immediately usable without a refetch.
 */
export async function createNote(accountId: string) {
  const result = await supabase
    .from("notes")
    .insert({ account_id: accountId, title: "Untitled", content: EMPTY_DOC })
    .select()
    .single();
  if (result.error) console.error("createNote failed:", result.error);
  return result;
}

/**
 * Phase 1c: persists title/content edits for an existing note. Phase 3
 * part 1 adds tags to what gets saved. The notes table has no updated_at
 * trigger (unlike trades, which doesn't track this at all), so updated_at
 * is set explicitly here rather than relying on the DB — this is also what
 * the notes list sorts by, so it has to actually change on every save for
 * the list ordering to make sense.
 */
export async function updateNote(id: string, title: string, content: JSONContent, tags: string[]) {
  const result = await supabase
    .from("notes")
    .update({ title, content, tags, updated_at: new Date().toISOString() })
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
