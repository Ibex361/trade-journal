import Card from "@/components/shared/Card";
import type { Note } from "@/lib/notes";
import { extractPreviewText } from "@/lib/notes";

function formatUpdated(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function NotesList({ notes }: { notes: Note[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((note) => {
        const preview = extractPreviewText(note.content);
        return (
          <Card
            key={note.id}
            padding="tight"
            className="space-y-2 cursor-default hover:border-glow/40 transition-colors duration-fast"
          >
            <h3 className="font-display text-base font-medium text-ink-primary truncate">
              {note.title || "Untitled"}
            </h3>
            <p className="text-ink-secondary text-sm line-clamp-2 min-h-[2.5rem]">
              {preview || <span className="text-ink-muted italic">No content yet</span>}
            </p>
            <p className="text-ink-muted text-xs">Updated {formatUpdated(note.updated_at)}</p>
          </Card>
        );
      })}
    </div>
  );
}
