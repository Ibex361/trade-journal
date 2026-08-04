"use client";

import { useState } from "react";
import type { JSONContent } from "@tiptap/react";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import NoteEditor from "@/components/notes/NoteEditor";
import type { Note } from "@/lib/notes";

/**
 * Phase 1c part 2 adds Delete (with a ConfirmDialog, same component the
 * Trades page's delete flow uses) on top of part 1's open/edit/save.
 *
 * Dirty tracking is intentionally simple (title/content changed since last
 * save) rather than a full undo-aware diff — good enough to decide whether
 * "Close" should warn.
 */
export default function NoteEditPanel({
  note,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  note: Note;
  saving: boolean;
  deleting: boolean;
  onSave: (title: string, content: JSONContent) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent | null>(note.content);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

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
    <>
      <Card padding="tight" className="space-y-4 border-glow/40">
        <div className="flex items-start justify-between gap-3">
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 bg-transparent font-display text-lg font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
            placeholder="Note title"
          />
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)} disabled={saving || deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={deleting}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving || deleting}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        <NoteEditor content={content} onChange={handleContentChange} placeholder="Start writing…" />
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this note?"
        description={`"${title || "Untitled"}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
