"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { useAccount } from "@/lib/AccountContext";
import { supabase, type Note } from "@/lib/supabaseClient";
import {
  clearDraft,
  getOpenNoteId,
  readDraft,
  setOpenNoteId,
  writeDraft,
} from "@/lib/notesDraft";
import NoteEditor from "@/components/notes/NoteEditor";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EMPTY_DOC: JSONContent = {
  type: "doc",
  content: [{ type: "paragraph" }],
};

function stableJson(value: unknown) {
  return JSON.stringify(value ?? null);
}

function notePreview(content: JSONContent | null | undefined, max = 100): string {
  if (!content) return "";
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (parts.join(" ").length >= max) return;
    if (node.type === "text" && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(content);
  const text = parts.join(" ").replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > max ? `${text.slice(0, max).trimEnd()}…` : text;
}

function relativeUpdated(iso: string) {
  try {
    const then = new Date(iso).getTime();
    const now = Date.now();
    const sec = Math.round((now - then) / 1000);
    if (sec < 45) return "Just now";
    if (sec < 3600) return `${Math.round(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.round(sec / 3600)}h ago`;
    if (sec < 86400 * 7) return `${Math.round(sec / 86400)}d ago`;
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: new Date(iso).getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
    });
  } catch {
    return iso;
  }
}

/**
 * Notes page.
 *
 * Mobile-critical: local draft persistence on every edit + pagehide so
 * backgrounding the browser never wipes in-progress work. History back-guard
 * ignores events while the document is hidden (Samsung/Chrome quirk).
 * Server write is still explicit Save only — no autosave.
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState<JSONContent | null>(null);
  const savedSnapshot = useRef<{ title: string; content: string }>({
    title: "",
    content: stableJson(EMPTY_DOC),
  });
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(false);
  const titleRef = useRef("");
  const contentRef = useRef<JSONContent | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const savedFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [unsavedOpen, setUnsavedOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const interceptBackRef = useRef(false);
  const editorOpenedAtRef = useRef(0);
  const restoredRef = useRef(false);

  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    titleRef.current = title;
  }, [title]);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);
  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  const persistDraftNow = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id || !dirtyRef.current) return;
    writeDraft(id, titleRef.current, contentRef.current ?? EMPTY_DOC);
  }, []);

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
      restoredRef.current = false;
      return;
    }
    // Account change: leave editor, reload list
    setSelectedId(null);
    setTitle("");
    setContent(null);
    setDirty(false);
    restoredRef.current = false;
    fetchNotes(selectedAccount.id);
  }, [selectedAccount, fetchNotes]);

  // Restore open note + any local draft after list loads
  useEffect(() => {
    if (loading || restoredRef.current || selectedId || !notes.length) return;
    const savedId = getOpenNoteId();
    if (!savedId) {
      restoredRef.current = true;
      return;
    }
    const note = notes.find((n) => n.id === savedId);
    if (note) openNote(note, { preferDraft: true });
    restoredRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, notes, selectedId]);

  useEffect(() => {
    setOpenNoteId(selectedId);
  }, [selectedId]);

  // Keep a local draft while dirty so backgrounding the browser is safe
  useEffect(() => {
    if (!selectedId || !dirty) return;
    writeDraft(selectedId, title, content ?? EMPTY_DOC);
  }, [selectedId, title, content, dirty]);

  // pagehide / visibilitychange — flush draft; never close the editor
  useEffect(() => {
    function onHide() {
      persistDraftNow();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") persistDraftNow();
    }
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [persistDraftNow]);

  useEffect(() => {
    return () => {
      if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    };
  }, []);

  useEffect(() => {
    function onSaveEvent() {
      if (selectedIdRef.current) void handleSave();
    }
    window.addEventListener("notes:save", onSaveEvent);
    return () => window.removeEventListener("notes:save", onSaveEvent);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Mobile browser Back only — NOT app minimize.
   * Samsung Internet / Chrome can fire popstate while backgrounding when we
   * pushState on open. Ignore while document is hidden, and ignore for a short
   * window after open.
   */
  useEffect(() => {
    if (!selectedId) {
      interceptBackRef.current = false;
      return;
    }

    interceptBackRef.current = true;
    editorOpenedAtRef.current = Date.now();
    window.history.pushState({ notesEditor: selectedId }, "");

    function onPopState() {
      if (!interceptBackRef.current) return;
      // Backgrounding / tab switch — do not treat as Back
      if (document.visibilityState === "hidden") {
        window.history.pushState({ notesEditor: selectedIdRef.current }, "");
        return;
      }
      // Ignore spurious popstate right after open
      if (Date.now() - editorOpenedAtRef.current < 400) {
        window.history.pushState({ notesEditor: selectedIdRef.current }, "");
        return;
      }

      window.history.pushState({ notesEditor: selectedIdRef.current }, "");
      if (dirtyRef.current) {
        setUnsavedOpen(true);
      } else {
        interceptBackRef.current = false;
        forceCloseNote();
      }
    }

    window.addEventListener("popstate", onPopState);
    return () => {
      interceptBackRef.current = false;
      window.removeEventListener("popstate", onPopState);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  function markClean(nextTitle: string, nextContent: JSONContent | null) {
    savedSnapshot.current = {
      title: nextTitle,
      content: stableJson(nextContent ?? EMPTY_DOC),
    };
    setDirty(false);
  }

  function recomputeDirty(nextTitle: string, nextContent: JSONContent | null) {
    const isDirty =
      nextTitle !== savedSnapshot.current.title ||
      stableJson(nextContent ?? EMPTY_DOC) !== savedSnapshot.current.content;
    setDirty(isDirty);
    if (isDirty) setSavedFlash(false);
  }

  function openNote(note: Note, opts?: { preferDraft?: boolean }) {
    let t = note.title || "Untitled";
    let c = note.content ?? EMPTY_DOC;
    let fromDraft = false;

    if (opts?.preferDraft) {
      const draft = readDraft(note.id);
      if (draft) {
        t = draft.title || t;
        c = draft.content ?? c;
        fromDraft = true;
      }
    }

    setSelectedId(note.id);
    setTitle(t);
    setContent(c);
    // Snapshot is always the server version so draft-restored content stays dirty
    savedSnapshot.current = {
      title: note.title || "Untitled",
      content: stableJson(note.content ?? EMPTY_DOC),
    };
    setDirty(
      fromDraft &&
        (t !== (note.title || "Untitled") ||
          stableJson(c) !== stableJson(note.content ?? EMPTY_DOC))
    );
    setSavedFlash(false);
    setError(null);
    setUnsavedOpen(false);
  }

  function forceCloseNote() {
    interceptBackRef.current = false;
    // Keep draft in sessionStorage so accidental close can still be recovered
    // via open id + preferDraft on next visit; clear only after successful save.
    setSelectedId(null);
    setTitle("");
    setContent(null);
    setDirty(false);
    setSavedFlash(false);
    setUnsavedOpen(false);
  }

  function requestCloseNote() {
    if (dirty) {
      setUnsavedOpen(true);
      return;
    }
    forceCloseNote();
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

  async function handleSave(): Promise<boolean> {
    if (!selectedId || saving) return false;
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
      return false;
    }
    setTitle(nextTitle);
    markClean(nextTitle, nextContent);
    clearDraft(selectedId);
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
    if (savedFlashTimer.current) clearTimeout(savedFlashTimer.current);
    savedFlashTimer.current = setTimeout(() => setSavedFlash(false), 2500);
    return true;
  }

  async function handleSaveAndClose() {
    const ok = await handleSave();
    if (ok) forceCloseNote();
    else setUnsavedOpen(false);
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
    clearDraft(id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (selectedId === id) {
      forceCloseNote();
    }
  }

  const deleteTarget = deleteTargetId
    ? notes.find((n) => n.id === deleteTargetId) ?? null
    : null;

  if (accountLoading || (selectedAccount && loading)) {
    return <NotesSkeleton />;
  }

  if (selectedId) {
    return (
      <>
        <div className="space-y-5 max-w-3xl">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <button
                type="button"
                onClick={requestCloseNote}
                className="text-sm text-ink-secondary hover:text-ink-primary transition-colors duration-fast mb-2"
              >
                ← All notes
              </button>
              <div className="flex items-center gap-2.5">
                <h1 className="font-display text-2xl font-medium tracking-tight">Edit note</h1>
                {dirty && !savedFlash && (
                  <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted bg-surface-2 border border-surface-border rounded-full px-2 py-0.5">
                    Unsaved
                  </span>
                )}
              </div>
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
              <Button variant="secondary" size="sm" onClick={requestCloseNote}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                {savedFlash && (
                  <span
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-glow motion-safe:animate-fade-in"
                    aria-live="polite"
                  >
                    <svg viewBox="0 0 16 16" fill="none" className="w-3.5 h-3.5" aria-hidden>
                      <circle cx="8" cy="8" r="7" className="stroke-glow/40" strokeWidth="1.5" />
                      <path
                        d="M4.5 8.2l2.2 2.2 4.8-4.8"
                        className="stroke-glow"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    Saved
                  </span>
                )}
                <Button size="sm" onClick={() => handleSave()} disabled={saving || (!dirty && !savedFlash)}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
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
              const next = e.target.value;
              setTitle(next);
              recomputeDirty(next, content);
            }}
            className="w-full bg-transparent font-display text-xl font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
            placeholder="Note title"
          />

          <NoteEditor
            key={selectedId}
            content={content}
            onChange={(next) => {
              setContent(next);
              recomputeDirty(title, next);
            }}
            placeholder="Start writing… Type / for commands"
          />

          <p className="text-[11px] text-ink-muted">
            Shortcuts: ⌘/Ctrl+B I U · ⌘/Ctrl+K link · ⌘/Ctrl+⇧H highlight · ⌘/Ctrl+S save
          </p>
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

        <Dialog open={unsavedOpen} onOpenChange={(o) => !o && setUnsavedOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unsaved changes</DialogTitle>
              <DialogDescription>
                You have edits that haven’t been saved. Save them, discard them, or keep
                editing.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="ghost" size="sm" onClick={() => setUnsavedOpen(false)}>
                Keep editing
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (selectedId) clearDraft(selectedId);
                  forceCloseNote();
                }}
              >
                Discard
              </Button>
              <Button size="sm" onClick={handleSaveAndClose} disabled={saving}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

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
              {notes.map((note) => {
                const preview = notePreview(note.content);
                return (
                  <li key={note.id} className="group flex items-stretch">
                    <button
                      type="button"
                      onClick={() => openNote(note, { preferDraft: true })}
                      className="flex-1 text-left px-4 sm:px-5 py-3.5 hover:bg-surface-2/50 transition-colors duration-fast min-w-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-medium text-ink-primary truncate">
                          {note.title || "Untitled"}
                        </div>
                        <div className="text-[11px] text-ink-muted shrink-0 tabular-nums">
                          {relativeUpdated(note.updated_at)}
                        </div>
                      </div>
                      {preview ? (
                        <div className="text-sm text-ink-secondary mt-1 line-clamp-2 leading-snug">
                          {preview}
                        </div>
                      ) : (
                        <div className="text-sm text-ink-muted mt-1 italic">Empty note</div>
                      )}
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
                );
              })}
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
