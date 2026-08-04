"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { useNotesPageState } from "@/lib/NotesPageStateContext";
import { fetchNotes, createNote, updateNote, deleteNote, extractFullText, type Note } from "@/lib/notes";
import { fetchDropdownItems, type DropdownItem } from "@/lib/dropdownSettings";
import NotesList from "@/components/notes/NotesList";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import NoteEditPanel from "@/components/notes/NoteEditPanel";
import NotesFilterBar, { NoteFilters, isNoteFiltersActive } from "@/components/notes/NotesFilterBar";
import Button from "@/components/shared/Button";

/**
 * Phase 3 part 2: search (title + full body text) and tag filtering.
 * Filtering runs client-side over the already-fetched notes list, same as
 * Trades — a search string is matched against the title plus
 * extractFullText's plain-text walk of the Tiptap doc (not the truncated
 * list-card preview, so a match past the 140-char preview cutoff still
 * hits). Wrapped in useDeferredValue + useMemo, mirroring the Trades/
 * Analytics/Reports INP perf pass, so typing in the search box doesn't
 * block re-render on every keystroke.
 */
function applyFilters(notes: Note[], filters: NoteFilters): Note[] {
  const search = filters.search.trim().toLowerCase();
  return notes.filter((n) => {
    if (search) {
      const haystack = `${n.title} ${extractFullText(n.content)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.tag && !(n.tags ?? []).includes(filters.tag)) return false;
    return true;
  });
}

/**
 * Phase 1c: notes are now fully open/edit/save/delete-able. Clicking a
 * list card or "New note" both open the same NoteEditPanel; saving persists
 * via updateNote and patches the note into local list state (no refetch
 * needed — same "update in place" approach TradesDataContext's mutation
 * paths use). Deleting removes it from local state the same way.
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  // Phase 3 part 3: the account's trades, already fetched/cached by
  // TradesDataProvider in the root layout — threaded down into
  // NoteEditPanel's LinkedTradesPicker rather than re-fetched here.
  const { trades } = useTradesData();
  const { filters, setFilters, resetFilters, activeNoteId, setActiveNoteId } = useNotesPageState();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);

  // Which note is open lives in NotesPageStateContext (see the comment
  // there) rather than local state, so navigating away mid-edit and back
  // reopens the same note instead of dropping back to the list — derived
  // from the fetched notes array + the persisted id, rather than storing
  // the Note object itself, so it can't go stale relative to what's in
  // `notes`. Note: this restores *which note was open*, not any unsaved
  // keystrokes typed into it — those still need Save before leaving.
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  useEffect(() => {
    if (!selectedAccount) {
      setDropdowns([]);
      return;
    }
    fetchDropdownItems(selectedAccount.id).then(({ data }) => {
      if (data) setDropdowns(data as DropdownItem[]);
    });
  }, [selectedAccount?.id]);

  useEffect(() => {
    if (!selectedAccount) {
      setNotes([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchNotes(selectedAccount.id).then(({ data, error }) => {
      if (cancelled) return;
      if (error) console.error("fetchNotes failed:", error);
      setNotes((data as Note[] | null) ?? []);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedAccount]);

  const deferredFilters = useDeferredValue(filters);
  const visibleNotes = useMemo(() => applyFilters(notes, deferredFilters), [notes, deferredFilters]);

  // Tags actually used on notes but no longer present in Settings would
  // otherwise be impossible to filter by (and easy to lose track of) —
  // union them with the active dropdown list so every tag in use stays
  // findable, same approach app/trades/page.tsx uses for its tag filter.
  const availableTags = useMemo(() => {
    const active = dropdowns.filter((d) => d.category === "tag").map((d) => d.value);
    const used = notes.flatMap((n) => n.tags ?? []);
    return Array.from(new Set([...active, ...used])).sort();
  }, [dropdowns, notes]);

  async function handleNewNote() {
    if (!selectedAccount || creating) return;
    setCreating(true);
    const { data, error } = await createNote(selectedAccount.id);
    setCreating(false);
    if (error || !data) return;
    const newNote = data as Note;
    setNotes((current) => [newNote, ...current]);
    setActiveNoteId(newNote.id);
  }

  function handleSelectNote(note: Note) {
    setActiveNoteId(note.id);
  }

  async function handleSaveNote(
    title: string,
    content: JSONContent,
    tags: string[],
    linkedTradeIds: string[],
    linkedStrategy: string | null
  ) {
    if (!activeNote || saving) return;
    setSaving(true);
    const { data, error } = await updateNote(activeNote.id, title, content, tags, linkedTradeIds, linkedStrategy);
    setSaving(false);
    if (error || !data) return;
    const updated = data as Note;
    // Re-sort to the top on save, matching fetchNotes' updated_at-desc
    // order, rather than leaving a just-edited note stranded wherever it
    // was before. activeNoteId doesn't need updating — it's already
    // `updated.id`, and activeNote re-derives from the patched `notes` array.
    setNotes((current) => {
      const rest = current.filter((n) => n.id !== updated.id);
      return [updated, ...rest];
    });
  }

  async function handleDeleteNote() {
    if (!activeNote || deleting) return;
    setDeleting(true);
    const { error } = await deleteNote(activeNote.id);
    setDeleting(false);
    if (error) return;
    setNotes((current) => current.filter((n) => n.id !== activeNote.id));
    setActiveNoteId(null);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Notes</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectedAccount ? `Diary entries for ${selectedAccount.name}` : "Your trading diary."}
          </p>
        </div>
        {selectedAccount && (
          <Button size="sm" onClick={handleNewNote} disabled={creating}>
            {creating ? "Creating…" : "New note"}
          </Button>
        )}
      </div>

      {accountLoading || loading ? (
        <NotesSkeleton />
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {activeNote && (
            <NoteEditPanel
              note={activeNote}
              trades={trades}
              saving={saving}
              deleting={deleting}
              onSave={handleSaveNote}
              onDelete={handleDeleteNote}
              onClose={() => setActiveNoteId(null)}
            />
          )}
          {notes.length === 0 ? (
            <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
              <p className="text-ink-muted text-sm">No notes yet.</p>
            </div>
          ) : (
            <>
              <NotesFilterBar filters={filters} onChange={setFilters} availableTags={availableTags} />
              {visibleNotes.length === 0 ? (
                <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center space-y-2">
                  <p className="text-ink-muted text-sm">No notes match your filters.</p>
                  {isNoteFiltersActive(filters) && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="text-xs text-glow hover:underline"
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <NotesList notes={visibleNotes} onSelectNote={handleSelectNote} />
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
