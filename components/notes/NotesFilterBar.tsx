"use client";

/**
 * Filter card for Notes — search plus four structured filters: tag, trade
 * linkage, strategy, and a date range. Superseded a left-rail "smart views"
 * navigation design (kept in git history) in favor of staying as a single
 * filter surface next to the list, on the user's call that a separate
 * navigation panel was overkill for this app's note volume.
 *
 * Trade linkage and strategy are two independent single-select controls
 * rather than one combined "view" — deliberately, so "not linked to a
 * trade" + a specific strategy can be combined (a real, useful query: "my
 * strategy notes that aren't tied to one specific trade"), and so "not
 * linked to a trade" + strategy "None" reproduces what would otherwise be a
 * dedicated "Lone" filter without needing one.
 */
export type TradeLinkage = "all" | "linked" | "unlinked";
export const NO_STRATEGY = "__none__";

export type NoteFilters = {
  search: string;
  tag: string;
  linkage: TradeLinkage;
  strategy: string; // "" = any strategy, NO_STRATEGY = notes with no strategy, else an exact strategy name
  dateFrom: string; // "" or "YYYY-MM-DD", inclusive, against updated_at
  dateTo: string; // "" or "YYYY-MM-DD", inclusive, against updated_at
};

export const EMPTY_NOTE_FILTERS: NoteFilters = {
  search: "",
  tag: "",
  linkage: "all",
  strategy: "",
  dateFrom: "",
  dateTo: "",
};

export function isNoteFiltersActive(f: NoteFilters): boolean {
  return (
    f.search !== "" ||
    f.tag !== "" ||
    f.linkage !== "all" ||
    f.strategy !== "" ||
    f.dateFrom !== "" ||
    f.dateTo !== ""
  );
}

const selectClass =
  "bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary";
const labelClass = "text-[11px] text-ink-secondary block mb-1";

const segmentBase = "px-2.5 py-1.5 text-xs rounded-md transition-colors duration-fast";
const segmentActive = "bg-glow/15 text-glow border border-glow/40";
const segmentInactive = "text-ink-secondary border border-transparent hover:text-ink-primary";

const LINKAGE_OPTIONS: { value: TradeLinkage; label: string }[] = [
  { value: "all", label: "All" },
  { value: "linked", label: "Linked" },
  { value: "unlinked", label: "Unlinked" },
];

export default function NotesFilterBar({
  filters,
  onChange,
  availableTags,
  availableStrategies,
}: {
  filters: NoteFilters;
  onChange: (f: NoteFilters) => void;
  availableTags: string[];
  availableStrategies: string[];
}) {
  function set<K extends keyof NoteFilters>(key: K, value: NoteFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const active = isNoteFiltersActive(filters);

  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-4 space-y-4">
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
            <select value={filters.tag} onChange={(e) => set("tag", e.target.value)} className={selectClass}>
              <option value="">Any tag</option>
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

      <div className="flex flex-wrap items-end gap-4 pt-3 border-t border-surface-border/60">
        <div>
          <span className={labelClass}>Trade link</span>
          <div className="flex gap-1 bg-surface-2 border border-surface-border rounded-md p-0.5">
            {LINKAGE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => set("linkage", opt.value)}
                className={`${segmentBase} ${filters.linkage === opt.value ? segmentActive : segmentInactive}`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>Strategy</span>
          <select value={filters.strategy} onChange={(e) => set("strategy", e.target.value)} className={selectClass}>
            <option value="">Any strategy</option>
            <option value={NO_STRATEGY}>None</option>
            {availableStrategies.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            max={filters.dateTo || undefined}
            className={selectClass}
          />
        </div>
        <div>
          <span className={labelClass}>To</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            min={filters.dateFrom || undefined}
            className={selectClass}
          />
        </div>
      </div>
    </div>
  );
}
