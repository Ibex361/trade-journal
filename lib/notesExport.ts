import { Note } from "./notes";

/** Schema version of the exported file — bump if the shape below changes,
 *  so a future importer can tell an old export apart from a new one. */
export const NOTES_EXPORT_VERSION = 1;

export type NotesExportRow = {
  title: string;
  content: Note["content"];
  tags: string[];
  linked_trade_ids: string[];
  linked_strategy: string | null;
  created_at: string;
  updated_at: string;
};

export type NotesExportFile = {
  version: number;
  exported_at: string;
  account_name: string;
  notes: NotesExportRow[];
};

// id/account_id deliberately excluded — same reasoning as CSV_COLUMNS in
// csvExport.ts: they're regenerated on insert and meaningless outside the
// account they were created in. created_at/updated_at ARE included and are
// restored verbatim on import (see notesImport.ts), so a backup/restore
// round-trip doesn't reorder the notes list or lose the diary's real
// timeline by re-stamping "now" on every row.
function toExportRow(note: Note): NotesExportRow {
  return {
    title: note.title,
    content: note.content,
    tags: note.tags,
    linked_trade_ids: note.linked_trade_ids,
    linked_strategy: note.linked_strategy,
    created_at: note.created_at,
    updated_at: note.updated_at,
  };
}

/** Builds the exportable JSON structure for a set of notes. */
export function notesToExportFile(notes: Note[], accountName: string): NotesExportFile {
  return {
    version: NOTES_EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    account_name: accountName,
    notes: notes.map(toExportRow),
  };
}

/** Triggers a browser download of the given notes export as a .json file. */
export function downloadNotesJson(file: NotesExportFile, filename: string) {
  const json = JSON.stringify(file, null, 2);
  const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
