import { memo, useCallback, useEffect, useMemo, useRef } from "react";
import Card from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import type { Note } from "@/lib/notes";
import { extractPreviewText } from "@/lib/notes";

const LONG_PRESS_MS = 450;

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/**
 * Efficiency fix (Aug 9 review pass 2): extractPreviewText walks the note's
 * full Tiptap JSON tree — same class of cost as the search bar's
 * extractFullText, just for the 140-char list-card snippet instead. This
 * used to run inline in NotesList's .map(), uncached, so *every* re-render
 * of the grid (selecting a note, entering selection mode, toggling one
 * checkbox) re-walked every visible note's document from scratch even
 * though nothing about the note itself had changed.
 *
 * Split into its own memoized component so React can skip re-rendering (and
 * therefore skip re-walking) a card whose props haven't actually changed —
 * e.g. toggling the checkbox on card A no longer re-renders or re-walks
 * cards B-Z. The preview text itself is additionally useMemo'd on
 * note.content specifically (not the whole note object), so even a
 * same-content update that only bumped an unrelated field wouldn't
 * re-walk — though in practice a changed `note` object identity already
 * means memo() re-renders this card regardless.
 */
const NoteCard = memo(function NoteCard({
  note,
  selectionMode,
  isSelected,
  onCardClick,
  onToggleSelect,
  onStartPress,
  onClearPressTimer,
  longPressFiredRef,
}: {
  note: Note;
  selectionMode: boolean;
  isSelected: boolean;
  onCardClick: (note: Note) => void;
  onToggleSelect: (id: string) => void;
  onStartPress: (id: string, target: EventTarget) => void;
  onClearPressTimer: () => void;
  longPressFiredRef: React.MutableRefObject<boolean>;
}) {
  const preview = useMemo(() => extractPreviewText(note.content), [note.content]);

  return (
    <button
      type="button"
      onClick={() => onCardClick(note)}
      onPointerDown={(e) => onStartPress(note.id, e.target)}
      onPointerUp={onClearPressTimer}
      onPointerLeave={onClearPressTimer}
      onPointerCancel={onClearPressTimer}
      onContextMenu={(e) => {
        if (longPressFiredRef.current) e.preventDefault();
      }}
      className="text-left"
    >
      <Card
        padding="tight"
        className={`space-y-2 h-full transition-colors duration-fast ${
          isSelected ? "border-glow/40 bg-glow/10" : "hover:border-glow/40"
        }`}
      >
        <div className="flex items-start gap-2">
          {selectionMode && (
            <input
              type="checkbox"
              checked={isSelected}
              onChange={() => {}}
              onClick={(e) => {
                e.stopPropagation();
                onToggleSelect(note.id);
              }}
              aria-label={`Select note ${note.title || "Untitled"}`}
              className="accent-glow mt-1 shrink-0"
            />
          )}
          <h3 className="font-display text-base font-medium text-ink-primary truncate">
            {note.title || "Untitled"}
          </h3>
        </div>
        <p className="text-ink-secondary text-sm line-clamp-2 min-h-[2.5rem]">
          {preview || <span className="text-ink-muted italic">No content yet</span>}
        </p>
        {note.tags && note.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {note.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}
        <p className="text-ink-muted text-xs">Updated {formatUpdated(note.updated_at)}</p>
      </Card>
    </button>
  );
});

export default function NotesList({
  notes,
  totalCount,
  onLoadMore,
  onSelectNote,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEnterSelectionMode,
}: {
  notes: Note[];
  /**
   * Count of all notes matching the current filter, before the reveal-count
   * slice in app/notes/page.tsx is applied — i.e. `notes.length` is what's
   * currently rendered, `totalCount` is what's rendered once every "load
   * more" batch has fired. Drives the "Showing N of M" label and whether
   * the scroll sentinel below has anything left to reveal. Mirrors
   * TradesList's identically-named prop.
   */
  totalCount: number;
  /**
   * Called when the scroll sentinel enters the viewport. Owner (the Notes
   * page) is responsible for growing revealCount — this component has no
   * opinion on batch size, it only reports "the user scrolled to the end
   * of what's currently shown."
   */
  onLoadMore: () => void;
  onSelectNote: (note: Note) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEnterSelectionMode: (id: string) => void;
}) {
  // Compared against totalCount (every note matching the current filter),
  // not notes.length (just what's currently revealed) — otherwise, with
  // more unrevealed notes below the fold, checking every visible card would
  // show this as "all selected" while onToggleSelectAll (which operates on
  // the full filtered set in app/notes/page.tsx) would still have more to
  // select. Same fix TradesList needed when it gained its own reveal cap.
  const allSelected = totalCount > 0 && selectedIds.size === totalCount;

  // Long-press (or mouse-hold) support so selection mode can be entered by
  // pressing a note card directly, same convention as the Trades list —
  // no permanently-visible checkboxes needed to discover multi-select.
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);

  const clearPressTimer = useCallback(() => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  }, []);

  const startPress = useCallback(
    (id: string, target: EventTarget) => {
      if (selectionMode) return;
      if ((target as HTMLElement).closest("input")) return;
      longPressFired.current = false;
      clearPressTimer();
      pressTimer.current = setTimeout(() => {
        longPressFired.current = true;
        onEnterSelectionMode(id);
      }, LONG_PRESS_MS);
    },
    [selectionMode, clearPressTimer, onEnterSelectionMode]
  );

  const handleCardClick = useCallback(
    (note: Note) => {
      if (longPressFired.current) {
        longPressFired.current = false;
        return;
      }
      if (selectionMode) onToggleSelect(note.id);
      else onSelectNote(note);
    },
    [selectionMode, onToggleSelect, onSelectNote]
  );

  // Infinite-scroll trigger: an IntersectionObserver on a sentinel div below
  // the grid, same approach as TradesList (avoids scroll-event throttling
  // and works regardless of card height, which varies here with tag count
  // and preview length). Re-observes whenever there's more to reveal
  // (notes.length < totalCount); once everything is revealed the sentinel
  // unmounts and observation stops.
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const hasMore = notes.length < totalCount;

  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore();
      },
      { rootMargin: "400px" } // fire a bit before the sentinel is actually on-screen, so the next batch is ready by the time the user scrolls to it
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  return (
    <div className="space-y-3">
      {selectionMode && (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            aria-label="Select all notes"
            className="accent-glow"
          />
          <span className="text-[11px] text-ink-secondary">Select all</span>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {notes.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(note.id)}
            onCardClick={handleCardClick}
            onToggleSelect={onToggleSelect}
            onStartPress={startPress}
            onClearPressTimer={clearPressTimer}
            longPressFiredRef={longPressFired}
          />
        ))}
      </div>

      {/* Reveal-count status + scroll sentinel — same convention as
          TradesList. Shown even once hasMore is false (as "Showing M of M")
          so the count doesn't just disappear; only the sentinel itself is
          conditionally rendered. */}
      <div className="flex items-center justify-center py-4">
        <span className="text-[11px] text-ink-muted">
          Showing {notes.length} of {totalCount} note{totalCount === 1 ? "" : "s"}
        </span>
      </div>
      {hasMore && <div ref={sentinelRef} aria-hidden="true" className="h-px" />}
    </div>
  );
}
