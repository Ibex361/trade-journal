"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { JSONContent } from "@tiptap/react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { useTradesPageState } from "@/lib/TradesPageStateContext";
import { useNotesPageState } from "@/lib/NotesPageStateContext";
import {
  fetchNotes,
  createNote,
  updateNote,
  deleteNote,
  deleteNotes,
  bulkAddNoteTag,
  bulkRemoveNoteTag,
  extractFullText,
  getUsedStrategies,
  type Note,
} from "@/lib/notes";
import { extractImageFileIds, deleteNoteImages } from "@/lib/noteImages";
import { fetchDistinctTags, type TagSettingItem } from "@/lib/tagSettings";
import NotesList from "@/components/notes/NotesList";
import NotesSkeleton from "@/components/notes/NotesSkeleton";
import NoteEditPanel from "@/components/notes/NoteEditPanel";
import NotesBulkActionsBar from "@/components/notes/NotesBulkActionsBar";
import NotesFilterBar, { NoteFilters, NO_STRATEGY, isNoteFiltersActive } from "@/components/notes/NotesFilterBar";
import Button from "@/components/shared/Button";
import type { Trade } from "@/lib/trades";

/**
 * Phase 3 part 2: search (title + full body text) and tag filtering.
 * Phase 6: extended with trade-linkage, strategy, and a date range — all
 * still client-side over the already-fetched notes list, same as Trades — a
 * search string is matched against the title plus extractFullText's
 * plain-text walk of the Tiptap doc (not the truncated list-card preview,
 * so a match past the 140-char preview cutoff still hits). Wrapped in
 * useDeferredValue + useMemo, mirroring the Trades/Analytics/Reports INP
 * perf pass, so typing in the search box doesn't block re-render on every
 * keystroke.
 *
 * Date range is inclusive on both ends and compares calendar dates (not
 * timestamps) against updated_at, so picking the same day for From and To
 * captures the whole day regardless of what time a note was last touched.
 */
function applyFilters(notes: Note[], filters: NoteFilters): Note[] {
  const search = filters.search.trim().toLowerCase();
  return notes.filter((n) => {
    if (search) {
      const haystack = `${n.title} ${extractFullText(n.content)}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (filters.tag && !(n.tags ?? []).includes(filters.tag)) return false;

    const hasTradeLink = (n.linked_trade_ids?.length ?? 0) > 0;
    if (filters.linkage === "linked" && !hasTradeLink) return false;
    if (filters.linkage === "unlinked" && hasTradeLink) return false;

    if (filters.strategy === NO_STRATEGY && n.linked_strategy) return false;
    if (filters.strategy && filters.strategy !== NO_STRATEGY && n.linked_strategy !== filters.strategy) return false;

    if (filters.dateFrom || filters.dateTo) {
      const noteDate = n.updated_at.slice(0, 10); // "YYYY-MM-DD", string-comparable
      if (filters.dateFrom && noteDate < filters.dateFrom) return false;
      if (filters.dateTo && noteDate > filters.dateTo) return false;
    }

    return true;
  });
}

/**
 * Phase 1c: notes are now fully open/edit/save/delete-able. Clicking a
 * list card or "New note" both open the same NoteEditPanel; saving persists
 * via updateNote and patches the note into local list state (no refetch
 * needed — same "update in place" approach TradesDataContext's mutation
 * paths use). Deleting removes it from local state the same way.
 *
 * Phase 5 Part 1: handleSaveNote is now called both by NoteEditPanel's
 * manual Save button and by its internal debounced autosave — this page
 * doesn't need to know which, it just tracks `saving`/`saveError` the same
 * way either way. saveError is new: previously a failed save only logged
 * to the console and left the user clicking a Save button that quietly did
 * nothing; now it's surfaced back down so the panel's status label can
 * show "Save failed" instead of silently discarding the edit.
 */
export default function NotesPage() {
  const { selectedAccount, loading: accountLoading } = useAccount();
  // Phase 3 part 3: the account's trades, already fetched/cached by
  // TradesDataProvider in the root layout — threaded down into
  // NoteEditPanel's LinkedTradesPicker rather than re-fetched here.
  const { trades } = useTradesData();
  const router = useRouter();
  const { setPendingTradeId } = useTradesPageState();
  const {
    filters,
    setFilters,
    resetFilters,
    activeNoteId,
    setActiveNoteId,
    pendingNewNote,
    setPendingNewNote,
  } = useNotesPageState();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  // Phase 5 Part 1: whether the most recent save attempt (manual or
  // autosave) failed, surfaced by NoteEditPanel's status label. Cleared
  // whenever a different note is opened so a stale error doesn't linger
  // onto a note that hasn't failed to save.
  const [saveError, setSaveError] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [tagSettings, setTagSettings] = useState<TagSettingItem[]>([]);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleteError, setBulkDeleteError] = useState<string | null>(null);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const enterSelectionMode = useCallback((id: string) => {
    setSelectionMode(true);
    setSelectedIds(new Set([id]));
  }, []);

  // Which note is open lives in NotesPageStateContext (see the comment
  // there) rather than local state, so navigating away mid-edit and back
  // reopens the same note instead of dropping back to the list — derived
  // from the fetched notes array + the persisted id, rather than storing
  // the Note object itself, so it can't go stale relative to what's in
  // `notes`. Note: this restores *which note was open*, not any unsaved
  // keystrokes typed into it — those still need Save before leaving.
  const activeNote = notes.find((n) => n.id === activeNoteId) ?? null;

  // Resets the stale error banner when switching notes. Deliberately an
  // effect rather than replicated at each of the 4 places activeNoteId
  // changes (new note, select note, delete note, close) — one spot instead
  // of 4 call sites that would be easy to let drift out of sync. The extra
  // same-tick render this can cause is harmless here (saveError going back
  // to false a tick after activeNoteId changes isn't visible to the user).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSaveError(false);
  }, [activeNoteId]);

  // Tag setting migration part 2 (updated): the "+ Tag" bulk-add chip list
  // now sources from every tag actually in use (fetchDistinctTags) rather
  // than the old curated tag_settings list — that list is no longer
  // maintained via the UI as of the Tag setting reshape, so it would
  // otherwise silently go stale. Synthesized into TagSettingItem shape
  // (NotesBulkActionsBar only reads .id/.value) so the bar itself needed no
  // changes.
  useEffect(() => {
    // No account selected (e.g. logged out, no accounts yet) — clear
    // rather than leave a stale list from a previously selected account.
    if (!selectedAccount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTagSettings([]);
      return;
    }
    fetchDistinctTags(selectedAccount.id).then((tags) => {
      setTagSettings(
        tags.map((value) => ({ id: value, value }))
      );
    });
    // Keyed on the id, not the object — same reasoning as the notes-fetch
    // effect below (spurious object-identity churn from AccountContext
    // shouldn't re-trigger this fetch).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  useEffect(() => {
    // Same as the tag-settings effect above: no account selected, clear
    // rather than show a stale list.
    if (!selectedAccount) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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
    // Deliberately keyed on the id, not the selectedAccount object itself.
    // AccountContext hands back a brand-new object every time its accounts
    // array is refreshed (e.g. on the auth token refresh Supabase fires
    // when the tab regains visibility after being backgrounded — such as
    // switching to the Files app to browse for an image to insert into a
    // note) even when the selected account hasn't actually changed. Keying
    // on the object was re-running this effect on those spurious refreshes,
    // which flips `loading` back to true and unmounts/remounts
    // NoteEditPanel (swapped for NotesSkeleton) mid-edit — destroying the
    // live Tiptap editor instance and silently dropping any in-flight,
    // not-yet-saved change (e.g. an image upload that had already
    // completed and just needed to be inserted into the doc).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  useEffect(() => {
    // Clears any selection referencing notes that may no longer be visible
    // once filters change, so bulk actions can't silently apply to a
    // now-hidden note.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    exitSelectionMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Lets a keyboard user back out of selection mode quickly without hunting
  // for the Cancel button — same convention as the Trades page.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setSelectionMode((prev) => {
        if (prev) setSelectedIds(new Set());
        return false;
      });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const deferredFilters = useDeferredValue(filters);
  const visibleNotes = useMemo(() => applyFilters(notes, deferredFilters), [notes, deferredFilters]);

  // tagSettings is now itself "tags in use" (see the effect above), so this
  // union with notes' own tags is redundant but harmless — kept as a
  // belt-and-suspenders fallback in case tagSettings hasn't loaded yet.
  const availableTags = useMemo(() => {
    const active = tagSettings.map((t) => t.value);
    const used = notes.flatMap((n) => n.tags ?? []);
    return Array.from(new Set([...active, ...used])).sort();
  }, [tagSettings, notes]);

  // Strategy filter options: only strategies actually present on a note,
  // not every strategy that exists elsewhere in the app (Trades/Settings) —
  // an option with zero matching notes would be a dead end in this dropdown.
  const availableStrategies = useMemo(() => getUsedStrategies(notes), [notes]);

  const handleNewNote = useCallback(async () => {
    if (!selectedAccount || creating) return;
    setCreating(true);
    const { data, error } = await createNote(selectedAccount.id);
    setCreating(false);
    if (error || !data) return;
    const newNote = data as Note;
    setNotes((current) => [newNote, ...current]);
    setActiveNoteId(newNote.id);
  }, [selectedAccount, creating, setActiveNoteId]);

  // Picks up a "new note" request set by MobileTabBar's FAB (the plus
  // button's "New note" choice) via NotesPageStateContext.pendingNewNote
  // before navigating here. handleNewNote() guards on !selectedAccount and
  // silently no-ops, so this effect has to wait for selectedAccount to be
  // ready rather than fire immediately on mount — otherwise a fast FAB tap
  // right after a fresh page load could land before the account resolves
  // and the flag would clear without ever creating the note. The flag is
  // cleared *before* calling handleNewNote() (it's async) rather than
  // after, to avoid any chance of a double-fire if selectedAccount changes
  // again mid-request.
  useEffect(() => {
    if (!pendingNewNote || !selectedAccount) return;
    // Consumes a flag set by MobileTabBar's FAB before navigating here —
    // there's no local event handler to move this into, since the trigger
    // is "this page just mounted with the flag already set."
    setPendingNewNote(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- handleNewNote's setCreating(true) runs before its first await; same "consuming an external flag on mount" case as above.
    handleNewNote();
  }, [pendingNewNote, selectedAccount, setPendingNewNote, handleNewNote]);

  function handleSelectNote(note: Note) {
    setActiveNoteId(note.id);
  }

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    setSelectedIds((prev) => {
      const allCurrentlySelected =
        visibleNotes.length > 0 && visibleNotes.every((n) => prev.has(n.id));
      return allCurrentlySelected ? new Set() : new Set(visibleNotes.map((n) => n.id));
    });
  }, [visibleNotes]);

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds);
    setBulkDeleteError(null);
    const targets = notes.filter((n) => ids.includes(n.id));
    const { error } = await deleteNotes(ids);
    if (error) {
      setBulkDeleteError("Couldn't delete the selected notes. Please try again.");
      return;
    }
    // Same orphaned-image cleanup handleDeleteNote does for a single note,
    // fire-and-forget, applied across every deleted note's content.
    targets.forEach((n) => {
      const fileIds = extractImageFileIds(n.content);
      if (fileIds.length > 0) deleteNoteImages(fileIds);
    });
    setNotes((current) => current.filter((n) => !ids.includes(n.id)));
    exitSelectionMode();
  }

  async function handleBulkAddTag(tag: string) {
    const ids = Array.from(selectedIds);
    await bulkAddNoteTag(ids, tag);
    setNotes((current) =>
      current.map((n) =>
        ids.includes(n.id) && !(n.tags ?? []).includes(tag)
          ? { ...n, tags: [...(n.tags ?? []), tag] }
          : n
      )
    );
  }

  async function handleBulkRemoveTag(tag: string) {
    const ids = Array.from(selectedIds);
    await bulkRemoveNoteTag(ids, tag);
    setNotes((current) =>
      current.map((n) =>
        ids.includes(n.id) ? { ...n, tags: (n.tags ?? []).filter((existing) => existing !== tag) } : n
      )
    );
  }

  const selectedNotes = useMemo(
    () => notes.filter((n) => selectedIds.has(n.id)),
    [notes, selectedIds]
  );
  const removableTags = useMemo(
    () => Array.from(new Set(selectedNotes.flatMap((n) => n.tags ?? []))).sort(),
    [selectedNotes]
  );

  async function handleSaveNote(
    title: string,
    content: JSONContent,
    tags: string[],
    linkedTradeIds: string[],
    linkedStrategy: string | null
  ) {
    if (!activeNote || saving) return;
    setSaving(true);
    setSaveError(false);
    // Captured before the update, since activeNote re-derives from `notes`
    // (see the comment above) and would already reflect the new content
    // by the time we compare below otherwise.
    const previousContent = activeNote.content;
    const { data, error } = await updateNote(activeNote.id, title, content, tags, linkedTradeIds, linkedStrategy);
    setSaving(false);
    if (error || !data) {
      setSaveError(true);
      return;
    }
    const updated = data as Note;
    // Re-sort to the top on save, matching fetchNotes' updated_at-desc
    // order, rather than leaving a just-edited note stranded wherever it
    // was before. activeNoteId doesn't need updating — it's already
    // `updated.id`, and activeNote re-derives from the patched `notes` array.
    setNotes((current) => {
      const rest = current.filter((n) => n.id !== updated.id);
      return [updated, ...rest];
    });
    // Phase 4 Part 3: any image that was in the doc before this save but
    // isn't anymore (deleted by the user while editing, or a whole
    // paragraph/image removed) has no more references anywhere and its
    // ImageKit file would otherwise sit there forever. Diffed against the
    // now-saved content, not the local `content` param, so this can't
    // fire on a stale comparison if the save itself failed. Fire-and-forget
    // — doesn't block or affect the save the user is waiting on.
    const removedFileIds = extractImageFileIds(previousContent).filter(
      (id) => !extractImageFileIds(content).includes(id)
    );
    if (removedFileIds.length > 0) deleteNoteImages(removedFileIds);
  }

  async function handleDeleteNote() {
    if (!activeNote || deleting) return;
    setDeleting(true);
    const { error } = await deleteNote(activeNote.id);
    setDeleting(false);
    if (error) return;
    setNotes((current) => current.filter((n) => n.id !== activeNote.id));
    setActiveNoteId(null);
    // Phase 4 Part 3: the note row is gone, so every image still in its
    // content is now orphaned — clean all of them up. Best-effort, same
    // as the save path above.
    const fileIds = extractImageFileIds(activeNote.content);
    if (fileIds.length > 0) deleteNoteImages(fileIds);
  }

  /**
   * The reverse of Trades' "Diary" button: clicking a linked-trade chip in
   * NoteEditPanel jumps to that trade in the Trades page. Sets
   * TradesPageStateContext.pendingTradeId (root-mounted, so it's already
   * set by the time Trades mounts) and navigates — app/trades/page.tsx
   * picks it up once its own trades list has loaded and opens
   * TradeFormPanel for it.
   */
  function handleOpenTrade(trade: Trade) {
    setPendingTradeId(trade.id);
    router.push("/trades");
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="font-display text-2xl font-medium tracking-tight">Notes</h1>
          <p className="text-ink-secondary text-sm mt-1">
            {selectionMode
              ? `${selectedIds.size} selected`
              : selectedAccount
              ? `Diary entries for ${selectedAccount.name}`
              : "Your trading diary."}
          </p>
        </div>
        {selectionMode ? (
          <Button variant="secondary" size="sm" onClick={exitSelectionMode} className="shrink-0">
            Cancel
          </Button>
        ) : (
          selectedAccount && (
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setSelectionMode(true)}
                disabled={notes.length === 0}
              >
                Select
              </Button>
              <Button size="sm" onClick={handleNewNote} disabled={creating}>
                {creating ? "Creating…" : "New note"}
              </Button>
            </div>
          )
        )}
      </div>

      {selectedIds.size > 0 && (
        <NotesBulkActionsBar
          count={selectedIds.size}
          tagOptions={tagSettings}
          removableTags={removableTags}
          onAddTag={handleBulkAddTag}
          onRemoveTag={handleBulkRemoveTag}
          onDelete={handleBulkDelete}
          onClear={exitSelectionMode}
        />
      )}

      {bulkDeleteError && (
        <div className="rounded-md border border-loss/30 bg-loss/10 px-4 py-3 flex items-center justify-between gap-4">
          <p className="text-xs text-loss">{bulkDeleteError}</p>
          <button
            onClick={() => setBulkDeleteError(null)}
            className="text-xs text-ink-muted hover:text-ink-primary shrink-0"
          >
            Dismiss
          </button>
        </div>
      )}

      {accountLoading || loading ? (
        <NotesSkeleton />
      ) : !selectedAccount ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No account selected yet.</p>
        </div>
      ) : activeNote ? (
        <NoteEditPanel
          // Keyed by note id so switching notes (e.g. clicking a
          // different card while one is open, which bypasses Close's
          // dirty guard) remounts this panel instead of reusing the
          // previous instance's local state — otherwise a debounced
          // autosave scheduled against note A could fire after note B
          // is already open and overwrite it with A's content. This
          // also fixes the same staleness for the manual Save button,
          // which had the identical latent risk before Phase 5.
          key={activeNote.id}
          note={activeNote}
          trades={trades}
          saving={saving}
          saveError={saveError}
          deleting={deleting}
          onSave={handleSaveNote}
          onDelete={handleDeleteNote}
          onClose={() => setActiveNoteId(null)}
          onOpenTrade={handleOpenTrade}
        />
      ) : notes.length === 0 ? (
        <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
          <p className="text-ink-muted text-sm">No notes yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <NotesFilterBar
            filters={filters}
            onChange={setFilters}
            availableTags={availableTags}
            availableStrategies={availableStrategies}
          />
          {visibleNotes.length === 0 ? (
            <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center space-y-2">
              <p className="text-ink-muted text-sm">No notes match your filters.</p>
              {isNoteFiltersActive(filters) && (
                <button type="button" onClick={resetFilters} className="text-xs text-glow hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <NotesList
              notes={visibleNotes}
              onSelectNote={handleSelectNote}
              selectionMode={selectionMode}
              selectedIds={selectedIds}
              onToggleSelect={toggleSelect}
              onToggleSelectAll={toggleSelectAll}
              onEnterSelectionMode={enterSelectionMode}
            />
          )}
        </div>
      )}
    </div>
  );
}
