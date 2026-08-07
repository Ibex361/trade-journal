import { useCallback, useRef } from "react";
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

export default function NotesList({
  notes,
  onSelectNote,
  selectionMode,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  onEnterSelectionMode,
}: {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onEnterSelectionMode: (id: string) => void;
}) {
  const allSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));

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
        {notes.map((note) => {
          const preview = extractPreviewText(note.content);
          const isSelected = selectedIds.has(note.id);
          return (
            <button
              key={note.id}
              type="button"
              onClick={() => handleCardClick(note)}
              onPointerDown={(e) => startPress(note.id, e.target)}
              onPointerUp={clearPressTimer}
              onPointerLeave={clearPressTimer}
              onPointerCancel={clearPressTimer}
              onContextMenu={(e) => {
                if (longPressFired.current) e.preventDefault();
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
        })}
      </div>
    </div>
  );
}
