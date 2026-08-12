import type { JSONContent } from "@tiptap/react";
import type { NoteInput } from "./notes";
import { NOTES_EXPORT_VERSION, type NotesExportRow } from "./notesExport";

export type NoteImportIssue = { row: number; message: string };

export type ParsedNotesImport = {
  notes: NoteInput[];
  issues: NoteImportIssue[];
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isJsonContent(value: unknown): value is JSONContent {
  // Tiptap docs are recursive { type, content?, text?, ... } trees — this
  // isn't a full schema validation, just enough to catch "this clearly
  // isn't a Tiptap doc" (wrong file, hand-edited JSON) before it reaches
  // the editor, which is what actually needs the full shape to be right.
  return isPlainObject(value) && typeof value.type === "string";
}

/**
 * Parses and validates a previously-exported notes JSON file. Deliberately
 * tolerant per-row (like parseTradesCsv/parseExnessCsv) — one malformed
 * note doesn't fail the whole file, it's collected as an issue and
 * skipped. Row numbers are 1-based positions within the file's `notes`
 * array, for issue messages to point at ("Note 3: ...").
 */
export function parseNotesJson(text: string): ParsedNotesImport {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { notes: [], issues: [{ row: 0, message: "This file isn't valid JSON." }] };
  }

  if (!isPlainObject(parsed) || !Array.isArray(parsed.notes)) {
    return {
      notes: [],
      issues: [{ row: 0, message: "This doesn't look like a notes export from this app." }],
    };
  }

  if (typeof parsed.version === "number" && parsed.version > NOTES_EXPORT_VERSION) {
    // Forward-compat notice, not a hard failure — a newer export format
    // might still parse fine if later fields were purely additive.
    // Still attempt every row below.
  }

  const notes: NoteInput[] = [];
  const issues: NoteImportIssue[] = [];

  (parsed.notes as unknown[]).forEach((raw, i) => {
    const row = i + 1;
    if (!isPlainObject(raw)) {
      issues.push({ row, message: "Not a valid note entry — skipped." });
      return;
    }
    const r = raw as Partial<NotesExportRow>;

    if (typeof r.title !== "string" || r.title.trim() === "") {
      issues.push({ row, message: "Missing title — skipped." });
      return;
    }
    if (!isJsonContent(r.content)) {
      issues.push({ row, message: "Missing or invalid content — skipped." });
      return;
    }
    if (typeof r.created_at !== "string" || typeof r.updated_at !== "string") {
      issues.push({ row, message: "Missing created/updated timestamp — skipped." });
      return;
    }

    notes.push({
      title: r.title,
      content: r.content,
      tags: Array.isArray(r.tags) ? r.tags.filter((t): t is string => typeof t === "string") : [],
      linked_trade_ids: Array.isArray(r.linked_trade_ids)
        ? r.linked_trade_ids.filter((t): t is string => typeof t === "string")
        : [],
      linked_strategy: typeof r.linked_strategy === "string" ? r.linked_strategy : null,
      created_at: r.created_at,
      updated_at: r.updated_at,
    });
  });

  return { notes, issues };
}

/**
 * Fast, non-cryptographic string hash (djb2 variant) for duplicate
 * detection on import. Not for security — just a short, fixed-size
 * fingerprint so dedupe doesn't require holding full note bodies (which
 * can run to several KB each for a long diary entry) in memory as Set
 * keys. Collisions are not a real-world concern at personal-journal scale;
 * a false-positive "duplicate" would only occur if two notes had byte-
 * identical title+content AND happened to collide, which is negligible.
 */
function hashString(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = (h * 33) ^ str.charCodeAt(i);
  }
  return (h >>> 0).toString(36);
}

/** Fingerprint used to detect "this note already exists" — title + content
 *  only (not tags/links/timestamps), matching the intuition that a note is
 *  a duplicate if a human would call it the same note. */
export function hashNote(title: string, content: JSONContent): string {
  return hashString(title + JSON.stringify(content));
}

/**
 * Splits a parsed import into notes not already present in `existingHashes`
 * and a count of how many were filtered out — same shape as Trades'
 * broker_ticket dedupe (parsed.trades filtered against
 * getExistingBrokerTickets), just keyed on a content fingerprint instead
 * of a broker-supplied id, since notes have no natural external unique key.
 */
export function filterDuplicateNotes(
  notes: NoteInput[],
  existingHashes: Set<string>
): { ready: NoteInput[]; duplicateCount: number } {
  const ready = notes.filter((n) => !existingHashes.has(hashNote(n.title, n.content)));
  return { ready, duplicateCount: notes.length - ready.length };
}
