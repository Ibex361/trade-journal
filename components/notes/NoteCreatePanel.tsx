"use client";

import { useState } from "react";
import type { JSONContent } from "@tiptap/react";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import NoteEditor from "@/components/notes/NoteEditor";
import type { Note } from "@/lib/notes";

/**
 * Phase 1b part 2 — the create-note flow's editing surface. Opens
 * immediately after "New note" inserts a blank row, so there's something
 * to look at and try the editor on right away. Title and content only
 * live in local state here: nothing typed in this panel is written back
 * to Supabase (the row that was inserted stays "Untitled" / empty content
 * in the DB). Full open/edit/save/delete for notes — including editing
 * this same note again later — is Phase 1c.
 */
export default function NoteCreatePanel({
  note,
  onClose,
}: {
  note: Note;
  onClose: () => void;
}) {
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent | null>(note.content);

  return (
    <Card padding="tight" className="space-y-4 border-glow/40">
      <div className="flex items-start justify-between gap-3">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 bg-transparent font-display text-lg font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
          placeholder="Note title"
        />
        <Button variant="ghost" size="sm" onClick={onClose}>
          Close
        </Button>
      </div>

      <p className="text-ink-muted text-xs">
        This note was created — editing it here isn't saved yet. Full save/edit is coming next.
      </p>

      <NoteEditor content={content} onChange={setContent} placeholder="Start writing…" />
    </Card>
  );
}
