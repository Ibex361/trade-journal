"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchNotes, type Note } from "@/lib/notes";
import NotesList from "@/components/notes/NotesList";
import NotesSkeleton from "@/components/notes/NotesSkeleton";

/**
 * Phase 1b, part 1: real notes list wired to Supabase (read-only) plus the
 * nav/icon/mobile-tab-bar entries that make this page reachable. Notes are
 * fetched directly here rather than through a shared context — unlike
 * trades, nothing else in the app needs the notes list yet, so the
 * TradesDataContext-style "fetch once, share across pages" treatment isn't
 * needed until something else actually consumes it.
 *
 * The "New note" / create flow and opening a note into NoteEditor land in
 * part 2 of this phase; full edit/save/delete follows in Phase 1c. Cards
 * here are intentionally inert for now.
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">Notes</h1>
        <p className="text-ink-secondary text-sm mt-1">
          {selectedAccount ? `Diary entries for ${selectedAccount.name}` : "Your trading diary."}
        </p>
      </div>

      {accountLoading || loading ? (
        <NotesSkeleton />
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : notes.length === 0 ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No notes yet.</p>
        </div>
      ) : (
        <NotesList notes={notes} />
      )}
    </div>
  );
}
