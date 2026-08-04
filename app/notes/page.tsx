"use client";

import { useCallback, useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { useAccount } from "@/lib/AccountContext";
import { supabase, type Note } from "@/lib/supabaseClient";
import NoteEditor from "@/components/notes/NoteEditor";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function formatUpdated(iso: string) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/**
 * Notes — Phase 1b.
 *
 * List + create + open editor. Create inserts a real row. Opening a note
 * loads its title/content into local state so you can edit; a lightweight
 * Save button writes those edits back (full CRUD polish, empty states
 * refinement, and delete land in Phase 1c).
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<JSONContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNotes = useCallback(async (accountId: string) => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("notes")
      .select("id, account_id, title, content, created_at, updated_at")
      .eq("account_id", accountId)
      .order("updated_at", { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setNotes([]);
    } else {
      setNotes((data as Note[]) ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!selectedAccount) {
      setNotes([]);
      setSelectedId(null);
      setLoading(false);
      return;
    }
    setSelectedId(null);
    fetchNotes(selectedAccount.id);
  }, [selectedAccount, fetchNotes]);

  function openNote(note: Note) {
    setSelectedId(note.id);
    setTitle(note.title || "Untitled");
    setContent(note.content ?? EMPTY_DOC);
  }

  function closeNote() {
    setSelectedId(null);
    setTitle("");
    setContent(null);
  }

  async function handleCreate() {
    if (!selectedAccount || creating) return;
    setCreating(true);
    setError(null);
    const { data, error: insErr } = await supabase
      .from("notes")
      .insert({
        account_id: selectedAccount.id,
        title: "Untitled",
        content: EMPTY_DOC,
      })
      .select("id, account_id, title, content, created_at, updated_at")
      .single();

    setCreating(false);
    if (insErr || !data) {
      setError(insErr?.message ?? "Could not create note");
      return;
    }
    const note = data as Note;
    setNotes((prev) => [note, ...prev]);
    openNote(note);
  }

  async function handleSave() {
    if (!selectedId || saving) return;
    setSaving(true);
    setError(null);
    const now = new Date().toISOString();
    const { error: upErr } = await supabase
      .from("notes")
      .update({
        title: title.trim() || "Untitled",
        content: content ?? EMPTY_DOC,
        updated_at: now,
      })
      .eq("id", selectedId);

    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setNotes((prev) =>
      prev
        .map((n) =>
          n.id === selectedId
            ? {
                ...n,
                title: title.trim() || "Untitled",
                content: content ?? EMPTY_DOC,
                updated_at: now,
              }
            : n
        )
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    );
  }

  if (accountLoading || (selectedAccount && loading && notes.length === 0 && !error)) {
    return <NotesSkeleton />;
  }

  // Editor view when a note is open
  if (selectedId) {
    return (
      <div className="space-y-6 max-w-3xl">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <button
              type="button"
              onClick={closeNote}
              className="text-sm text-ink-secondary hover:text-ink-primary transition-colors duration-fast mb-2"
            >
              ← All notes
            </button>
            <h1 className="font-display text-2xl font-medium tracking-tight">Edit note</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={closeNote}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {error && (
          <p className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">{error}</p>
        )}

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

  // List view
  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Notes</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectedAccount
              ? `Journal for ${selectedAccount.name}`
              : "Trading diary and free-form notes."}
          </p>
        </div>
        <Button onClick={handleCreate} disabled={!selectedAccount || creating}>
          {creating ? "Creating…" : "New note"}
        </Button>
      </div>

      {error && (
        <p className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">{error}</p>
      )}

      {!selectedAccount ? (
        <Card>
          <p className="text-ink-muted text-sm text-center py-6">No account selected yet.</p>
        </Card>
      ) : notes.length === 0 ? (
        <Card>
          <div className="text-center py-10 space-y-3">
            <p className="text-ink-muted text-sm">No notes yet for this account.</p>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? "Creating…" : "Write your first note"}
            </Button>
          </div>
        </Card>
      ) : (
        <Card padding="none" className="overflow-hidden">
          <ul className="divide-y divide-surface-border">
            {notes.map((note) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => openNote(note)}
                  className="w-full text-left px-4 sm:px-5 py-4 hover:bg-surface-2/50 transition-colors duration-fast"
                >
                  <div className="font-medium text-ink-primary truncate">
                    {note.title || "Untitled"}
                  </div>
                  <div className="text-xs text-ink-muted mt-1 font-mono">
                    Updated {formatUpdated(note.updated_at)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
