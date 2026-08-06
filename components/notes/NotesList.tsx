import Card from "@/components/shared/Card";
import Badge from "@/components/shared/Badge";
import type { Note } from "@/lib/notes";
import { extractPreviewText } from "@/lib/notes";

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
}: {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
}) {
  const allSelected = notes.length > 0 && notes.every((n) => selectedIds.has(n.id));

  return (
    <div className="space-y-3">
      {selectionMode && (
        <div className="flex items-center gap-2 px-1">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={onToggleSelectAll}
            aria-label="Select all notes"
            className="accent-brass"
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
              onClick={() => (selectionMode ? onToggleSelect(note.id) : onSelectNote(note))}
              className="text-left"
            >
              <Card
                padding="tight"
                className={`space-y-2 h-full transition-colors duration-fast ${
                  isSelected ? "border-brass/40 bg-brass/10" : "hover:border-glow/40"
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
                      className="accent-brass mt-1 shrink-0"
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
