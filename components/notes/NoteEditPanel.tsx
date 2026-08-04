"use client";

import { useState } from "react";
import type { JSONContent } from "@tiptap/react";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import NoteEditor from "@/components/notes/NoteEditor";
import type { Note } from "@/lib/notes";

/**
 * Phase 1c part 1 — replaces Phase 1b part 2's NoteCreatePanel (which only
 * ever showed a freshly-created note and never actually saved). This is
 * the open/edit/save surface for any note, new or existing: title +
 * NoteEditor, an explicit Save button (no autosave yet — that's Phase 5 of
 * the original 5-phase plan). Delete lands in part 2.
 *
 * Dirty tracking is intentionally simple (title/content changed since last
 * save) rather than a full undo-aware diff — good enough to decide whether
 * "Close" should warn.
 */
export default function NoteEditPanel({
  note,
  saving,
  onSave,
  onClose,
}: {
  note: Note;
  saving: boolean;
  onSave: (title: string, content: JSONContent) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent | null>(note.content);
  const [dirty, setDirty] = useState(false);

  function handleTitleChange(value: string) {
    setTitle(value);
    setDirty(true);
  }

  function handleContentChange(value: JSONContent) {
    setContent(value);
    setDirty(true);
  }

  function handleSave() {
    onSave(title.trim() || "Untitled", content ?? { type: "doc", content: [{ type: "paragraph" }] });
    setDirty(false);
  }

  function handleClose() {
    if (dirty && !window.confirm("You have unsaved changes. Close without saving?")) return;
    onClose();
  }

  return (
    <Card padding="tight" className="space-y-4 border-glow/40">
      <div className="flex items-start justify-between gap-3">
        <input
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          className="flex-1 bg-transparent font-display text-lg font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
          placeholder="Note title"
        />
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Close
          </Button>
          <Button size="sm" onClick={handleSave} disabled={!dirty || saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <NoteEditor content={content} onChange={handleContentChange} placeholder="Start writing…" />
    </Card>
  );
}
