import { describe, it, expect } from "vitest";
import { notesToExportFile } from "../notesExport";
import { parseNotesJson, hashNote, filterDuplicateNotes } from "../notesImport";
import type { Note } from "../notes";

// Mirrors csvRoundTrip.test.ts's reasoning: exercises export -> import as a
// pair, since that's the actual path a user's data takes (backup/restore,
// or copying notes into another account).

function makeNote(overrides: Partial<Note> = {}): Note {
  return {
    id: "note-1",
    account_id: "acct-1",
    title: "EURUSD win, Mar 15",
    content: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: "Clean breakout, held to target." }],
        },
      ],
    },
    tags: ["momentum", "high-conviction"],
    linked_trade_ids: ["trade-1"],
    linked_strategy: "Breakout",
    created_at: "2026-03-15T09:30:00.000Z",
    updated_at: "2026-03-15T10:00:00.000Z",
    ...overrides,
  };
}

describe("Notes JSON export -> import round trip", () => {
  it("round-trips a note's fields exactly, including rich content and links", () => {
    const note = makeNote();
    const file = notesToExportFile([note], "Main");
    const { notes, issues } = parseNotesJson(JSON.stringify(file));

    expect(issues).toHaveLength(0);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toEqual({
      title: note.title,
      content: note.content,
      tags: note.tags,
      linked_trade_ids: note.linked_trade_ids,
      linked_strategy: note.linked_strategy,
      created_at: note.created_at,
      updated_at: note.updated_at,
    });
  });

  it("does not include id/account_id in the exported file", () => {
    const file = notesToExportFile([makeNote()], "Main");
    const raw = JSON.parse(JSON.stringify(file));
    expect(raw.notes[0]).not.toHaveProperty("id");
    expect(raw.notes[0]).not.toHaveProperty("account_id");
  });

  it("round-trips a note with no tags/links", () => {
    const note = makeNote({ tags: [], linked_trade_ids: [], linked_strategy: null });
    const file = notesToExportFile([note], "Main");
    const { notes, issues } = parseNotesJson(JSON.stringify(file));
    expect(issues).toHaveLength(0);
    expect(notes[0].tags).toEqual([]);
    expect(notes[0].linked_trade_ids).toEqual([]);
    expect(notes[0].linked_strategy).toBeNull();
  });
});

describe("parseNotesJson error handling", () => {
  it("rejects invalid JSON", () => {
    const { notes, issues } = parseNotesJson("not json {{{");
    expect(notes).toHaveLength(0);
    expect(issues[0].message).toMatch(/valid JSON/);
  });

  it("rejects a file with no notes array", () => {
    const { notes, issues } = parseNotesJson(JSON.stringify({ foo: "bar" }));
    expect(notes).toHaveLength(0);
    expect(issues[0].message).toMatch(/doesn't look like/);
  });

  it("skips an entry missing content but keeps the rest of the file", () => {
    const file = notesToExportFile([makeNote(), makeNote({ title: "Second note" })], "Main");
    const raw = JSON.parse(JSON.stringify(file));
    delete raw.notes[0].content;

    const { notes, issues } = parseNotesJson(JSON.stringify(raw));
    expect(notes).toHaveLength(1);
    expect(notes[0].title).toBe("Second note");
    expect(issues).toHaveLength(1);
    expect(issues[0].row).toBe(1);
    expect(issues[0].message).toMatch(/content/);
  });

  it("skips an entry missing a title", () => {
    const file = notesToExportFile([makeNote()], "Main");
    const raw = JSON.parse(JSON.stringify(file));
    raw.notes[0].title = "";

    const { notes, issues } = parseNotesJson(JSON.stringify(raw));
    expect(notes).toHaveLength(0);
    expect(issues[0].message).toMatch(/title/);
  });
});

describe("hashNote / filterDuplicateNotes", () => {
  it("produces the same hash for identical title+content, regardless of other fields", () => {
    const a = makeNote({ tags: ["a"], updated_at: "2026-01-01T00:00:00.000Z" });
    const b = makeNote({ tags: ["b", "c"], updated_at: "2026-06-01T00:00:00.000Z" });
    expect(hashNote(a.title, a.content)).toBe(hashNote(b.title, b.content));
  });

  it("produces different hashes when title or content differs", () => {
    const a = makeNote();
    const differentTitle = makeNote({ title: "Different title" });
    const differentContent = makeNote({
      content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Other." }] }] },
    });
    expect(hashNote(a.title, a.content)).not.toBe(hashNote(differentTitle.title, differentTitle.content));
    expect(hashNote(a.title, a.content)).not.toBe(hashNote(differentContent.title, differentContent.content));
  });

  it("filters out notes whose fingerprint is already present, keeps the rest", () => {
    const existing = makeNote();
    const duplicate = makeNote({ tags: [], updated_at: "2026-08-01T00:00:00.000Z" }); // same title+content, different metadata
    const genuinelyNew = makeNote({ title: "A different note entirely" });

    const existingHashes = new Set([hashNote(existing.title, existing.content)]);
    const file = notesToExportFile([duplicate, genuinelyNew], "Main");
    const { notes } = parseNotesJson(JSON.stringify(file));

    const { ready, duplicateCount } = filterDuplicateNotes(notes, existingHashes);
    expect(duplicateCount).toBe(1);
    expect(ready).toHaveLength(1);
    expect(ready[0].title).toBe("A different note entirely");
  });
});
