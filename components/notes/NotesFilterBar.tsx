"use client";

/**
 * Phase 3 part 2: search & filter for Notes. Deliberately smaller than
 * TradesFilterBar — notes only have a title/body and the shared tag
 * vocabulary to filter on, none of Trades' asset-class/session/P&L fields —
 * but follows the same visual language (pill-bordered panel, same input/
 * select styling, "Clear filters" link that only appears once something's
 * set).
 */
export type NoteFilters = {
  search: string;
  tag: string;
};

export const EMPTY_NOTE_FILTERS: NoteFilters = {
  search: "",
  tag: "",
};

export function isNoteFiltersActive(f: NoteFilters): boolean {
  return f.search !== "" || f.tag !== "";
}

const selectClass =
  "bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary";
const labelClass = "text-[11px] text-ink-secondary block mb-1";

export default function NotesFilterBar({
  filters,
  onChange,
  availableTags,
}: {
  filters: NoteFilters;
  onChange: (f: NoteFilters) => void;
  availableTags: string[];
}) {
  function set<K extends keyof NoteFilters>(key: K, value: NoteFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const active = isNoteFiltersActive(filters);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[200px]">
          <span className={labelClass}>Search notes</span>
          <input
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search title or content…"
            className={`${selectClass} w-full`}
          />
        </div>

        {availableTags.length > 0 && (
          <div>
            <span className={labelClass}>Tag</span>
            <select
              value={filters.tag}
              onChange={(e) => set("tag", e.target.value)}
              className={selectClass}
            >
              <option value="">All</option>
              {availableTags.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_NOTE_FILTERS)}
            className="text-xs text-ink-secondary hover:text-loss px-1 py-1.5"
          >
            Clear filters
          </button>
        )}
      </div>
    </div>
  );
}
