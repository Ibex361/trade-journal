"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchNotes, createNote, type Note } from "@/lib/notes";
import NotesList from "@/components/notes/NotesList";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import NoteCreatePanel from "@/components/notes/NoteCreatePanel";
import Button from "@/components/shared/Button";

/**
 * Phase 1b, part 1: real notes list wired to Supabase (read-only) plus the
 * nav/icon/mobile-tab-bar entries that make this page reachable. Notes are
 * fetched directly here rather than through a shared context — unlike
 * trades, nothing else in the app needs the notes list yet, so the
 * TradesDataContext-style "fetch once, share across pages" treatment isn't
 * needed until something else actually consumes it.
 *
 * Part 2: the "New note" button inserts a blank note (persisted) and opens
 * it in NoteCreatePanel right away. Editing an *existing* list card, and
 * saving further edits on any note, are Phase 1c — cards stay inert here.
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [activeNote, setActiveNote] = useState<Note | null>(null);

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

  // Closing the create panel doesn't need a refetch — the row already
  // reflects what's in the DB (blank), since nothing typed in the panel
  // gets written back yet. Only the insert itself needs the list updated.
  useEffect(() => {
    setActiveNote(null);
  }, [selectedAccount]);

  async function handleNewNote() {
    if (!selectedAccount || creating) return;
    setCreating(true);
    const { data, error } = await createNote(selectedAccount.id);
    setCreating(false);
    if (error || !data) return;
    const newNote = data as Note;
    setNotes((current) => [newNote, ...current]);
    setActiveNote(newNote);
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
            <NoteCreatePanel note={activeNote} onClose={() => setActiveNote(null)} />
          )}
          {notes.length === 0 ? (
            <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
              <p className="text-ink-muted text-sm">No notes yet.</p>
            </div>
          ) : (
            <NotesList notes={notes} />
          )}
        </div>
      )}
    </div>
  );
}
