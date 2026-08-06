import { supabase } from "./supabaseClient";
import type { JSONContent } from "@tiptap/react";

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
 *
 * `linkedTradeIds` (added for the "open/create diary from a trade" flow —
 * see findNoteLinkedToTrade below) lets a note be created already linked
 * to a trade, so the note that opens in the Notes page after redirecting
 * from Trades is the same one the link check will find next time. Defaults
 * to none for the plain "New note" button on the Notes page itself.
 */
export async function createNote(accountId: string, linkedTradeIds: string[] = []) {
  const result = await supabase
    .from("notes")
    .insert({ account_id: accountId, title: "Untitled", content: EMPTY_DOC, linked_trade_ids: linkedTradeIds })
    .select()
    .single();
  if (result.error) console.error("createNote failed:", result.error);
  return result;
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
 * Notes navigation views (left rail). Every view is derived from fields the
 * `notes` table already has — no schema change, no folder/parent column.
 * "strategy"/"tag" are followed by the specific key being viewed (e.g.
 * "strategy:Breakout"), stored as one string so NotesPageStateContext only
 * has to persist a single value, the same way it already persists
 * activeNoteId.
 */
export type NoteView =
  | "all"
  | "linked-trades"
  | "untagged"
  | { kind: "strategy"; strategy: string }
  | { kind: "tag"; tag: string }
  | { kind: "month"; month: string }; // "YYYY-MM"

export const UNSPECIFIED_STRATEGY = "Unspecified";

/** A note has nothing to organize it by — the true catch-all/orphan case. */
export function isNoteUntagged(note: Note): boolean {
  return (note.tags?.length ?? 0) === 0 && !note.linked_strategy && (note.linked_trade_ids?.length ?? 0) === 0;
}

/** "YYYY-MM" key for a note's updated_at, used by the By month view. */
export function noteMonthKey(note: Note): string {
  const d = new Date(note.updated_at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function formatMonthLabel(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

export type NoteGroupCount = { key: string; label: string; count: number };

/**
 * Strategy groups include every note with a linked_strategy set, whether or
 * not it's also linked to a specific trade (per product decision — strategy
 * grouping is not split by trade-linkage). Notes with no strategy at all are
 * excluded here; they surface via Untagged instead, not as an "Unspecified"
 * bucket.
 */
export function getStrategyGroups(notes: Note[]): NoteGroupCount[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    if (!n.linked_strategy) continue;
    counts.set(n.linked_strategy, (counts.get(n.linked_strategy) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function getTagGroups(notes: Note[]): NoteGroupCount[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    for (const t of n.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: key, count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** Newest month first, matching the notes list's own newest-first ordering. */
export function getMonthGroups(notes: Note[]): NoteGroupCount[] {
  const counts = new Map<string, number>();
  for (const n of notes) {
    const key = noteMonthKey(n);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .map(([key, count]) => ({ key, label: formatMonthLabel(key), count }))
    .sort((a, b) => b.key.localeCompare(a.key));
}

export function getLinkedTradesCount(notes: Note[]): number {
  return notes.filter((n) => (n.linked_trade_ids?.length ?? 0) > 0).length;
}

export function getUntaggedCount(notes: Note[]): number {
  return notes.filter(isNoteUntagged).length;
}

/** Applies the selected left-rail view on top of the already-fetched notes list. */
export function applyNoteView(notes: Note[], view: NoteView): Note[] {
  if (view === "all") return notes;
  if (view === "linked-trades") return notes.filter((n) => (n.linked_trade_ids?.length ?? 0) > 0);
  if (view === "untagged") return notes.filter(isNoteUntagged);
  if (view.kind === "strategy") return notes.filter((n) => n.linked_strategy === view.strategy);
  if (view.kind === "tag") return notes.filter((n) => (n.tags ?? []).includes(view.tag));
  if (view.kind === "month") return notes.filter((n) => noteMonthKey(n) === view.month);
  return notes;
}

/** Stable string key for a NoteView — used for persistence and React keys. */
export function noteViewKey(view: NoteView): string {
  if (typeof view === "string") return view;
  if (view.kind === "strategy") return `strategy:${view.strategy}`;
  if (view.kind === "tag") return `tag:${view.tag}`;
  return `month:${view.month}`;
}

export function noteViewFromKey(key: string): NoteView {
  if (key === "all" || key === "linked-trades" || key === "untagged") return key;
  const [kind, ...rest] = key.split(":");
  const value = rest.join(":");
  if (kind === "strategy") return { kind: "strategy", strategy: value };
  if (kind === "tag") return { kind: "tag", tag: value };
  if (kind === "month") return { kind: "month", month: value };
  return "all";
}
