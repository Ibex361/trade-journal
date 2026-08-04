"use client";

import { useCallback, useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { useAccount } from "@/lib/AccountContext";
import { supabase, type Note } from "@/lib/supabaseClient";
import NoteEditor from "@/components/notes/NoteEditor";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";

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
 * Notes — Phase 1c.
 *
 * Full list CRUD: create, open/edit, save, delete (with confirm dialog).
 * Empty states and loading skeleton match the rest of the app. Autosave,
 * page-state context, search, and rich Phase 2 editing come later.
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<JSONContent | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
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
    setTitle("");
    setContent(null);
    fetchNotes(selectedAccount.id);
  }, [selectedAccount, fetchNotes]);

  function openNote(note: Note) {
    setSelectedId(note.id);
    setTitle(note.title || "Untitled");
    setContent(note.content ?? EMPTY_DOC);
    setSavedFlash(false);
    setError(null);
  }

  function closeNote() {
    setSelectedId(null);
    setTitle("");
    setContent(null);
    setSavedFlash(false);
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
    setSavedFlash(false);
    const now = new Date().toISOString();
    const nextTitle = title.trim() || "Untitled";
    const nextContent = content ?? EMPTY_DOC;
    const { error: upErr } = await supabase
      .from("notes")
      .update({
        title: nextTitle,
        content: nextContent,
        updated_at: now,
      })
      .eq("id", selectedId);

    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return;
    }
    setTitle(nextTitle);
    setNotes((prev) =>
      prev
        .map((n) =>
          n.id === selectedId
            ? { ...n, title: nextTitle, content: nextContent, updated_at: now }
            : n
        )
        .sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1))
    );
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 2000);
  }

  async function handleDeleteConfirm() {
    if (!deleteTargetId || deleting) return;
    setDeleting(true);
    setError(null);
    const id = deleteTargetId;
    const { error: delErr } = await supabase.from("notes").delete().eq("id", id);
    setDeleting(false);
    setDeleteTargetId(null);
    if (delErr) {
      setError(delErr.message);
      return;
    }
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
      closeNote();
    }
  }

  const deleteTarget = deleteTargetId
    ? notes.find((n) => n.id === deleteTargetId) ?? null
    : null;

  if (accountLoading || (selectedAccount && loading)) {
    return <NotesSkeleton />;
  }

  // —— Editor view ——
  if (selectedId) {
    return (
      <>
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
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="danger"
                size="sm"
                onClick={() => setDeleteTargetId(selectedId)}
                disabled={deleting}
              >
                Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={closeNote}>
                Close
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving…" : savedFlash ? "Saved" : "Save"}
              </Button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setSavedFlash(false);
            }}
            className="w-full bg-transparent font-display text-xl font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
            placeholder="Note title"
          />

          <NoteEditor
            content={content}
            onChange={(next) => {
              setContent(next);
              setSavedFlash(false);
            }}
            placeholder="Start writing…"
          />
        </div>

        <ConfirmDialog
          open={deleteTargetId === selectedId}
          title="Delete this note?"
          description={
            deleteTarget
              ? `“${deleteTarget.title || "Untitled"}” will be permanently removed. This can’t be undone.`
              : "This note will be permanently removed. This can’t be undone."
          }
          confirmLabel={deleting ? "Deleting…" : "Delete"}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setDeleteTargetId(null)}
        />
      </>
    );
  }

  // —— List view ——
  return (
    <>
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
          <p className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        {!selectedAccount ? (
          <Card>
            <p className="text-ink-muted text-sm text-center py-8">
              Select an account to view and write notes.
            </p>
          </Card>
        ) : notes.length === 0 ? (
          <Card>
            <div className="text-center py-12 space-y-4">
              <div className="mx-auto w-12 h-12 rounded-full bg-surface-2 border border-surface-border flex items-center justify-center">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-6 h-6 text-ink-muted"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6" />
                  <path d="M8 13h8M8 17h8M8 9h2" />
                </svg>
              </div>
              <div className="space-y-1">
                <p className="font-medium text-ink-primary">No notes yet</p>
                <p className="text-ink-muted text-sm max-w-sm mx-auto">
                  Capture session recaps, rules, and ideas for this account. Notes stay
                  scoped to the account you have selected.
                </p>
              </div>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Write your first note"}
              </Button>
            </div>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-surface-border">
              {notes.map((note) => (
                <li key={note.id} className="group flex items-stretch">
                  <button
                    type="button"
                    onClick={() => openNote(note)}
                    className="flex-1 text-left px-4 sm:px-5 py-4 hover:bg-surface-2/50 transition-colors duration-fast"
                  >
                    <div className="font-medium text-ink-primary truncate">
                      {note.title || "Untitled"}
                    </div>
                    <div className="text-xs text-ink-muted mt-1 font-mono">
                      Updated {formatUpdated(note.updated_at)}
                    </div>
                  </button>
                  <div className="flex items-center pr-3 sm:pr-4 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-fast">
                    <button
                      type="button"
                      aria-label={`Delete ${note.title || "Untitled"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setDeleteTargetId(note.id);
                      }}
                      className="text-xs text-ink-muted hover:text-loss px-2 py-1.5 rounded-md hover:bg-loss/10 transition-colors duration-fast"
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>

      <ConfirmDialog
        open={deleteTargetId != null && selectedId == null}
        title="Delete this note?"
        description={
          deleteTarget
            ? `“${deleteTarget.title || "Untitled"}” will be permanently removed. This can’t be undone.`
            : "This note will be permanently removed. This can’t be undone."
        }
        confirmLabel={deleting ? "Deleting…" : "Delete"}
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTargetId(null)}
      />
    </>
  );
}
