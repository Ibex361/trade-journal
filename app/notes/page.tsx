"use client";

import { useState } from "react";
import type { JSONContent } from "@tiptap/react";
import NoteEditor from "@/components/notes/NoteEditor";

/**
 * Phase 1a preview only. Local state, no Supabase read/write, no notes
 * list, no nav entry yet — this exists purely so the editor built in this
 * phase can be seen and tried on a real deploy. Phase 1b adds the notes
 * list + nav wiring; Phase 1c wires this editor to real create/save/delete
 * against the new `notes` table.
 */
export default function NotesPreviewPage() {
  const [title, setTitle] = useState("Untitled note");
  const [content, setContent] = useState<JSONContent | null>(null);

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Notes</h1>
        <p className="text-ink-secondary text-sm mt-1">
          Phase 1a preview — the editor only. Nothing here saves yet.
        </p>
      </div>

      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="w-full bg-transparent font-display text-xl font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
        placeholder="Note title"
      />

      <NoteEditor content={content} onChange={setContent} placeholder="Start writing…" />
    </div>
  );
}
