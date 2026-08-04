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
import NoteTagsInput from "@/components/notes/NoteTagsInput";
import type { Trade } from "@/lib/trades";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import Button from "@/components/shared/Button";
import Card from "@/components/shared/Card";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

function notePlainText(content: JSONContent | null | undefined): string {
  if (!content) return "";
  const parts: string[] = [];
  function walk(node: JSONContent) {
    if (node.type === "text" && node.text) parts.push(node.text);
    if (Array.isArray(node.content)) node.content.forEach(walk);
  }
  walk(content);
  return parts.join(" ").replace(/\s+/g, " ").trim().toLowerCase();
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

export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const accountId = selectedAccount?.id ?? null;

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
  const [tags, setTags] = useState<string[]>([]);
  const [linkedTradeId, setLinkedTradeId] = useState<string | null>(null);
  const [linkedStrategy, setLinkedStrategy] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTag, setFilterTag] = useState<string | null>(null);
  const [recentTrades, setRecentTrades] = useState<Trade[]>([]);
  const [strategyOptions, setStrategyOptions] = useState<string[]>([]);
  const tagsRef = useRef<string[]>([]);
  const linkedTradeIdRef = useRef<string | null>(null);
  const linkedStrategyRef = useRef<string | null>(null);
  const interceptBackRef = useRef(false);
  const editorOpenedAtRef = useRef(0);
  const restoredRef = useRef(false);
  const prevAccountIdRef = useRef<string | null>(null);

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
  useEffect(() => {
    tagsRef.current = tags;
  }, [tags]);
  useEffect(() => {
    linkedTradeIdRef.current = linkedTradeId;
  }, [linkedTradeId]);
  useEffect(() => {
    linkedStrategyRef.current = linkedStrategy;
  }, [linkedStrategy]);

  const persistDraftNow = useCallback(() => {
    const id = selectedIdRef.current;
    if (!id || !dirtyRef.current) return;
    writeDraft(id, titleRef.current, contentRef.current ?? EMPTY_DOC, {
      tags: tagsRef.current,
      linked_trade_id: linkedTradeIdRef.current,
      linked_strategy: linkedStrategyRef.current,
    });
  }, []);

  const fetchNotes = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    const { data, error: qErr } = await supabase
      .from("notes")
      .select(
        "id, account_id, title, content, tags, linked_trade_id, linked_strategy, created_at, updated_at"
      )
      .eq("account_id", id)
      .order("updated_at", { ascending: false });

    if (qErr) {
      setError(qErr.message);
      setNotes([]);
    } else {
      setNotes(
        ((data as Note[]) ?? []).map((n) => ({
          ...n,
          tags: n.tags ?? [],
          linked_trade_id: n.linked_trade_id ?? null,
          linked_strategy: n.linked_strategy ?? null,
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!accountId) {
      setNotes([]);
      setSelectedId(null);
      setTitle("");
      setContent(null);
      setTags([]);
      setLinkedTradeId(null);
      setLinkedStrategy(null);
      setDirty(false);
      setLoading(false);
      restoredRef.current = false;
      prevAccountIdRef.current = null;
      return;
    }

    const accountChanged = prevAccountIdRef.current !== accountId;
    prevAccountIdRef.current = accountId;

    if (accountChanged) {
      setSelectedId(null);
      setTitle("");
      setContent(null);
      setTags([]);
      setLinkedTradeId(null);
      setLinkedStrategy(null);
      setSearchQuery("");
      setFilterTag(null);
      setDirty(false);
      restoredRef.current = false;
      fetchNotes(accountId);
    } else if (notes.length === 0 && !loading) {
      fetchNotes(accountId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, fetchNotes]);

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

  useEffect(() => {
    if (!accountId) {
      setRecentTrades([]);
      setStrategyOptions([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("trades")
        .select("id, instrument, entry_date, strategy, pnl, direction")
        .eq("account_id", accountId)
        .order("entry_date", { ascending: false })
        .limit(40);
      if (cancelled) return;
      const rows = (data as Trade[]) ?? [];
      setRecentTrades(rows);
      const strats = Array.from(
        new Set(rows.map((t) => t.strategy).filter((s): s is string => !!s && s.trim().length > 0))
      ).sort((a, b) => a.localeCompare(b));
      setStrategyOptions(strats);
    })();
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  useEffect(() => {
    if (!selectedId || !dirty) return;
    writeDraft(selectedId, title, content ?? EMPTY_DOC, {
      tags,
      linked_trade_id: linkedTradeId,
      linked_strategy: linkedStrategy,
    });
  }, [selectedId, title, content, dirty, tags, linkedTradeId, linkedStrategy]);

  useEffect(() => {
    function onHide() {
      persistDraftNow();
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") persistDraftNow();
    }
    window.addEventListener("pagehide", onHide);
    window.addEventListener("freeze", onHide);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", onHide);
      window.removeEventListener("freeze", onHide);
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
      if (document.visibilityState === "hidden") {
        window.history.pushState({ notesEditor: selectedIdRef.current }, "");
        return;
      }
      if (Date.now() - editorOpenedAtRef.current < 500) {
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
    let cdoc = note.content ?? EMPTY_DOC;
    let nextTags = note.tags ?? [];
    let nextTrade = note.linked_trade_id ?? null;
    let nextStrat = note.linked_strategy ?? null;
    let fromDraft = false;

    if (opts?.preferDraft !== false) {
      const draft = readDraft(note.id);
      if (draft) {
        t = draft.title || t;
        cdoc = draft.content ?? cdoc;
        if (draft.tags) nextTags = draft.tags;
        if (draft.linked_trade_id !== undefined) nextTrade = draft.linked_trade_id;
        if (draft.linked_strategy !== undefined) nextStrat = draft.linked_strategy;
        fromDraft = true;
      }
    }

    setSelectedId(note.id);
    setTitle(t);
    setContent(cdoc);
    setTags(nextTags);
    setLinkedTradeId(nextTrade);
    setLinkedStrategy(nextStrat);
    savedSnapshot.current = {
      title: note.title || "Untitled",
      content: stableJson(note.content ?? EMPTY_DOC),
    };
    const serverTags = stableJson(note.tags ?? []);
    const isDirty =
      fromDraft &&
      (t !== (note.title || "Untitled") ||
        stableJson(cdoc) !== stableJson(note.content ?? EMPTY_DOC) ||
        stableJson(nextTags) !== serverTags ||
        nextTrade !== (note.linked_trade_id ?? null) ||
        nextStrat !== (note.linked_strategy ?? null));
    setDirty(isDirty);
    setSavedFlash(false);
    setError(null);
    setUnsavedOpen(false);
  }

  function forceCloseNote() {
    interceptBackRef.current = false;
    persistDraftNow();
    setSelectedId(null);
    setTitle("");
    setContent(null);
    setTags([]);
    setLinkedTradeId(null);
    setLinkedStrategy(null);
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
        tags: [],
        linked_trade_id: null,
        linked_strategy: null,
      })
      .select(
        "id, account_id, title, content, tags, linked_trade_id, linked_strategy, created_at, updated_at"
      )
      .single();

    setCreating(false);
    if (insErr || !data) {
      setError(insErr?.message ?? "Could not create note");
      return;
    }
    const note = data as Note;
    setNotes((prev) => [note, ...prev]);
    openNote(note, { preferDraft: false });
  }

  async function handleSave(): Promise<boolean> {
    const id = selectedIdRef.current;
    if (!id || saving) return false;
    setSaving(true);
    setError(null);
    setSavedFlash(false);
    const now = new Date().toISOString();
    const nextTitle = titleRef.current.trim() || "Untitled";
    const nextContent = contentRef.current ?? EMPTY_DOC;
    const nextTags = tagsRef.current;
    const nextTrade = linkedTradeIdRef.current;
    const nextStrat = linkedStrategyRef.current;
    const { error: upErr } = await supabase
      .from("notes")
      .update({
        title: nextTitle,
        content: nextContent,
        tags: nextTags,
        linked_trade_id: nextTrade,
        linked_strategy: nextStrat,
        updated_at: now,
      })
      .eq("id", id);

    setSaving(false);
    if (upErr) {
      setError(upErr.message);
      return false;
    }
    setTitle(nextTitle);
    setContent(nextContent);
    markClean(nextTitle, nextContent);
    clearDraft(id);
    setNotes((prev) =>
      prev
        .map((n) =>
          n.id === id
            ? {
                ...n,
                title: nextTitle,
                content: nextContent,
                tags: nextTags,
                linked_trade_id: nextTrade,
                linked_strategy: nextStrat,
                updated_at: now,
              }
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
    if (selectedId === id) forceCloseNote();
  }

  const deleteTarget = deleteTargetId
    ? notes.find((n) => n.id === deleteTargetId) ?? null
    : null;

  const allTags = Array.from(
    new Set(notes.flatMap((n) => n.tags ?? []).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filteredNotes = notes.filter((n) => {
    if (filterTag && !(n.tags ?? []).includes(filterTag)) return false;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    const t = (n.title || "").toLowerCase();
    const body = notePlainText(n.content);
    const tagStr = (n.tags ?? []).join(" ");
    return t.includes(q) || body.includes(q) || tagStr.includes(q);
  });

  if (accountLoading || (accountId && loading && notes.length === 0 && !selectedId)) {
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
              <Button variant="danger" size="sm" onClick={() => setDeleteTargetId(selectedId)} disabled={deleting}>
                Delete
              </Button>
              <Button variant="secondary" size="sm" onClick={requestCloseNote}>
                Close
              </Button>
              <div className="flex items-center gap-2">
                {savedFlash && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium text-glow motion-safe:animate-fade-in" aria-live="polite">
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
            <p className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">{error}</p>
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

          <NoteTagsInput
            tags={tags}
            suggestions={allTags}
            onChange={(next) => {
              setTags(next);
              setDirty(true);
              setSavedFlash(false);
            }}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">Linked trade</span>
              <select
                value={linkedTradeId ?? ""}
                onChange={(e) => {
                  setLinkedTradeId(e.target.value || null);
                  setDirty(true);
                  setSavedFlash(false);
                }}
                className="w-full rounded-lg bg-surface-2 border border-surface-border px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-glow/40"
              >
                <option value="">None</option>
                {recentTrades.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.entry_date} · {t.instrument}
                    {t.direction ? ` · ${t.direction}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="text-[11px] uppercase tracking-wide text-ink-muted">Linked strategy</span>
              <select
                value={linkedStrategy ?? ""}
                onChange={(e) => {
                  setLinkedStrategy(e.target.value || null);
                  setDirty(true);
                  setSavedFlash(false);
                }}
                className="w-full rounded-lg bg-surface-2 border border-surface-border px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-glow/40"
              >
                <option value="">None</option>
                {strategyOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <NoteEditor
            key={selectedId}
            content={content}
            onChange={(next) => {
              setContent(next);
              recomputeDirty(title, next);
            }}
            placeholder="Start writing… Type / for commands"
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

        <Dialog open={unsavedOpen} onOpenChange={(o) => !o && setUnsavedOpen(false)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Unsaved changes</DialogTitle>
              <DialogDescription>Save to the server, discard this draft, or keep editing.</DialogDescription>
            </DialogHeader>
            <div className="mt-6 flex flex-col gap-2">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    if (selectedId) clearDraft(selectedId);
                    forceCloseNote();
                  }}
                >
                  Discard
                </Button>
                <Button size="sm" className="w-full" onClick={handleSaveAndClose} disabled={saving}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
              <button
                type="button"
                onClick={() => setUnsavedOpen(false)}
                className="w-full text-center text-sm text-ink-secondary hover:text-ink-primary py-2 transition-colors duration-fast"
              >
                Keep editing
              </button>
            </div>
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
              {selectedAccount ? `Journal for ${selectedAccount.name}` : "Trading diary and free-form notes."}
            </p>
          </div>
          <Button onClick={handleCreate} disabled={!selectedAccount || creating}>
            {creating ? "Creating…" : "New note"}
          </Button>
        </div>

        {error && (
          <p className="text-sm text-loss bg-loss/10 border border-loss/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex flex-col gap-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search notes…"
            className="w-full rounded-lg bg-surface-2 border border-surface-border px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-glow/40"
          />
          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setFilterTag(null)}
                className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors duration-fast ${
                  !filterTag
                    ? "bg-glow/15 text-glow border-glow/30"
                    : "text-ink-muted border-surface-border hover:text-ink-primary"
                }`}
              >
                All
              </button>
              {allTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFilterTag((prev) => (prev === t ? null : t))}
                  className={`text-[11px] rounded-full px-2.5 py-1 border transition-colors duration-fast ${
                    filterTag === t
                      ? "bg-glow/15 text-glow border-glow/30"
                      : "text-ink-muted border-surface-border hover:text-ink-primary"
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}
        </div>

        {!selectedAccount ? (
          <Card>
            <p className="text-ink-muted text-sm text-center py-8">Select an account to view and write notes.</p>
          </Card>
        ) : notes.length === 0 ? (
          <Card>
            <div className="text-center py-12 space-y-4">
              <p className="font-medium text-ink-primary">No notes yet</p>
              <p className="text-ink-muted text-sm max-w-sm mx-auto">
                Capture session recaps, rules, and ideas for this account.
              </p>
              <Button onClick={handleCreate} disabled={creating}>
                {creating ? "Creating…" : "Write your first note"}
              </Button>
            </div>
          </Card>
        ) : (
          <Card padding="none" className="overflow-hidden">
            <ul className="divide-y divide-surface-border">
              {filteredNotes.length === 0 ? (
                <li className="px-4 py-8 text-center text-sm text-ink-muted">No notes match your search.</li>
              ) : null}
              {filteredNotes.map((note) => {
                const preview = notePreview(note.content);
                const hasDraft = !!readDraft(note.id);
                return (
                  <li key={note.id} className="group flex items-stretch">
                    <button
                      type="button"
                      onClick={() => openNote(note)}
                      className="flex-1 text-left px-4 sm:px-5 py-3.5 hover:bg-surface-2/50 transition-colors duration-fast min-w-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <div className="font-medium text-ink-primary truncate flex items-center gap-2">
                          {note.title || "Untitled"}
                          {hasDraft && (
                            <span className="text-[10px] font-medium uppercase tracking-wide text-glow/90 bg-glow/10 border border-glow/25 rounded-full px-1.5 py-0.5">
                              Draft
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-ink-muted shrink-0 tabular-nums">
                          {relativeUpdated(note.updated_at)}
                        </div>
                      </div>
                      {preview ? (
                        <div className="text-sm text-ink-secondary mt-1 line-clamp-2 leading-snug">{preview}</div>
                      ) : (
                        <div className="text-sm text-ink-muted mt-1 italic">Empty note</div>
                      )}
                      {(note.tags ?? []).length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {(note.tags ?? []).slice(0, 4).map((tg) => (
                            <span
                              key={tg}
                              className="text-[10px] text-glow/90 bg-glow/10 border border-glow/20 rounded-full px-1.5 py-0.5"
                            >
                              #{tg}
                            </span>
                          ))}
                        </div>
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
