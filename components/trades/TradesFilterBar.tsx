"use client";

import { useEffect, useState } from "react";
import { DropdownItem } from "@/lib/dropdownSettings";
import { Select } from "@/components/shared/Select";
import { FilterIcon, CloseIcon } from "@/components/icons";

export type TradeFilters = {
  search: string;
  assetClass: string;
  strategy: string;
  session: string;
  direction: "" | "long" | "short";
  rulesFollowed: "" | "yes" | "no";
  pnlOutcome: "" | "win" | "loss" | "breakeven";
  pnlMin: string;
  pnlMax: string;
  dateFrom: string;
  dateTo: string;
  tag: string;
};

export const EMPTY_FILTERS: TradeFilters = {
  search: "",
  assetClass: "",
  strategy: "",
  session: "",
  direction: "",
  rulesFollowed: "",
  pnlOutcome: "",
  pnlMin: "",
  pnlMax: "",
  dateFrom: "",
  dateTo: "",
  tag: "",
};

export function isFiltersActive(f: TradeFilters): boolean {
  return Object.values(f).some((v) => v !== "");
}

// Count of active filters, for the mobile trigger's badge. Separate from
// isFiltersActive (which only needs a boolean) since the badge wants the
// actual number.
function activeFilterCount(f: TradeFilters): number {
  return Object.values(f).filter((v) => v !== "").length;
}

const selectClass =
  "bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary";
const labelClass = "text-[11px] text-ink-secondary block mb-1";

type FilterControlsProps = {
  filters: TradeFilters;
  set: <K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) => void;
  dropdowns: DropdownItem[];
  availableTags: string[];
  /** Stacks fields full-width in a single column — used inside the mobile
   *  sheet, where the desktop's wrapped-row layout wouldn't fit. */
  stacked?: boolean;
};

/**
 * The 12 actual filter controls, extracted so both the desktop inline bar
 * and the mobile sheet render the exact same inputs/logic — the two
 * surfaces must never drift out of sync on what's filterable.
 */
function FilterControls({ filters, set, dropdowns, availableTags, stacked }: FilterControlsProps) {
  const optionsFor = (category: string) =>
    dropdowns
      .filter((d) => d.category === category)
      .sort((a, b) => a.sort_order - b.sort_order);

  const wrapClass = stacked ? "" : "flex-1 min-w-[160px]";

  return (
    <>
      <div className={wrapClass}>
        <span className={labelClass}>Search instrument</span>
        <input
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="e.g. EUR/USD"
          className={`${selectClass} w-full`}
        />
      </div>

      <div>
        <span className={labelClass}>Asset class</span>
        <Select
          value={filters.assetClass}
          onChange={(v) => set("assetClass", v)}
          options={[
            { value: "", label: "All" },
            ...optionsFor("asset_class").map((o) => ({ value: o.value, label: o.value })),
          ]}
        />
      </div>

      <div>
        <span className={labelClass}>Strategy</span>
        <Select
          value={filters.strategy}
          onChange={(v) => set("strategy", v)}
          options={[
            { value: "", label: "All" },
            ...optionsFor("strategy").map((o) => ({ value: o.value, label: o.value })),
          ]}
        />
      </div>

      <div>
        <span className={labelClass}>Session</span>
        <Select
          value={filters.session}
          onChange={(v) => set("session", v)}
          options={[
            { value: "", label: "All" },
            ...optionsFor("session").map((o) => ({ value: o.value, label: o.value })),
          ]}
        />
      </div>

      <div>
        <span className={labelClass}>Tag</span>
        <Select
          value={filters.tag}
          onChange={(v) => set("tag", v)}
          options={[
            { value: "", label: "All" },
            ...availableTags.map((t) => ({ value: t, label: t })),
          ]}
        />
      </div>

      <div>
        <span className={labelClass}>Direction</span>
        <div className={`flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border ${stacked ? "w-fit" : ""}`}>
          {[
            { label: "All", value: "" },
            { label: "Long", value: "long" },
            { label: "Short", value: "short" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => set("direction", opt.value as TradeFilters["direction"])}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filters.direction === opt.value
                  ? "bg-glow text-surface-0 font-medium"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelClass}>Rules followed</span>
        <div className={`flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border ${stacked ? "w-fit" : ""}`}>
          {[
            { label: "All", value: "" },
            { label: "Yes", value: "yes" },
            { label: "No", value: "no" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => set("rulesFollowed", opt.value as TradeFilters["rulesFollowed"])}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filters.rulesFollowed === opt.value
                  ? "bg-glow text-surface-0 font-medium"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <span className={labelClass}>P&amp;L outcome</span>
        <div className={`flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border ${stacked ? "w-fit" : ""}`}>
          {[
            { label: "All", value: "" },
            { label: "Win", value: "win" },
            { label: "Loss", value: "loss" },
            { label: "B/E", value: "breakeven" },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => set("pnlOutcome", opt.value as TradeFilters["pnlOutcome"])}
              className={`px-3 py-1 rounded-full text-xs transition-colors ${
                filters.pnlOutcome === opt.value
                  ? "bg-glow text-surface-0 font-medium"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className={stacked ? "flex gap-3" : undefined}>
        <div className={stacked ? "flex-1" : undefined}>
          <span className={labelClass}>Min P&amp;L</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={filters.pnlMin}
            onChange={(e) => set("pnlMin", e.target.value)}
            placeholder="−∞"
            className={`${selectClass} font-mono ${stacked ? "w-full" : "w-24"}`}
          />
        </div>

        <div className={stacked ? "flex-1" : undefined}>
          <span className={labelClass}>Max P&amp;L</span>
          <input
            type="number"
            inputMode="decimal"
            step="any"
            value={filters.pnlMax}
            onChange={(e) => set("pnlMax", e.target.value)}
            placeholder="+∞"
            className={`${selectClass} font-mono ${stacked ? "w-full" : "w-24"}`}
          />
        </div>
      </div>

      <div className={stacked ? "flex gap-3" : undefined}>
        <div className={stacked ? "flex-1" : undefined}>
          <span className={labelClass}>From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            className={`${selectClass} font-mono ${stacked ? "w-full" : ""}`}
          />
        </div>

        <div className={stacked ? "flex-1" : undefined}>
          <span className={labelClass}>To</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            className={`${selectClass} font-mono ${stacked ? "w-full" : ""}`}
          />
        </div>
      </div>
    </>
  );
}

export default function TradesFilterBar({
  filters,
  onChange,
  dropdowns,
  availableTags,
}: {
  filters: TradeFilters;
  onChange: (f: TradeFilters) => void;
  dropdowns: DropdownItem[];
  availableTags: string[];
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  // Draft state so the mobile sheet's edits only take effect on "Apply" —
  // editing 12 fields in a full-screen sheet with no visible trade list
  // behind it benefits from a deliberate commit step, unlike the desktop
  // bar (always-visible list, so live filtering is the right feedback loop
  // there and stays unchanged).
  const [draft, setDraft] = useState(filters);

  function openSheet() {
    // Seed the draft from the live filters at the moment the sheet opens
    // (not via an effect keyed on sheetOpen — that would setState during
    // render-driven synchronization rather than in response to the actual
    // user action of opening the sheet).
    setDraft(filters);
    setSheetOpen(true);
  }

  function set<K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  function setDraftField<K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
  }

  const active = isFiltersActive(filters);
  const activeCount = activeFilterCount(filters);

  return (
    <>
      {/* Desktop / tablet: unchanged inline bar, every control always visible. */}
      <div className="hidden md:block bg-surface-1 border border-surface-border rounded-card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <FilterControls filters={filters} set={set} dropdowns={dropdowns} availableTags={availableTags} />
          {active && (
            <button
              type="button"
              onClick={() => onChange(EMPTY_FILTERS)}
              className="text-xs text-ink-secondary hover:text-loss px-1 py-1.5"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Mobile: collapsed behind a trigger so the trade list isn't pushed
          below a dozen stacked controls on every visit (design review #7). */}
      <div className="md:hidden flex items-center gap-2">
        <button
          type="button"
          onClick={openSheet}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          className="flex items-center gap-2 bg-surface-1 border border-surface-border rounded-full pl-3.5 pr-3 py-2 text-xs text-ink-primary"
        >
          <FilterIcon className="w-4 h-4" />
          <span>Filters</span>
          {activeCount > 0 && (
            <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-glow text-surface-0 text-[10px] font-medium">
              {activeCount}
            </span>
          )}
        </button>
        {active && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
            className="text-xs text-ink-secondary hover:text-loss px-1 py-1.5"
          >
            Clear filters
          </button>
        )}
      </div>

      <FilterSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        draft={draft}
        setDraftField={setDraftField}
        dropdowns={dropdowns}
        availableTags={availableTags}
        onApply={() => {
          onChange(draft);
          setSheetOpen(false);
        }}
        onClear={() => setDraft(EMPTY_FILTERS)}
      />
    </>
  );
}

/**
 * Mobile filter sheet — same hand-rolled overlay convention as AppHeader's
 * MoreDrawer (fixed inset-0 backdrop + panel, body scroll lock, Escape to
 * close, rendered as a sibling rather than nested under any sticky/blurred
 * ancestor). Bottom sheet rather than a side drawer: this is a form the
 * user fills in and commits, not app navigation, so it uses the "slide-up"
 * keyframe already defined in tailwind.config for exactly this case.
 */
function FilterSheet({
  open,
  onClose,
  draft,
  setDraftField,
  dropdowns,
  availableTags,
  onApply,
  onClear,
}: {
  open: boolean;
  onClose: () => void;
  draft: TradeFilters;
  setDraftField: <K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) => void;
  dropdowns: DropdownItem[];
  availableTags: string[];
  onApply: () => void;
  onClear: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const draftActive = isFiltersActive(draft);

  return (
    <div className="md:hidden fixed inset-0 z-40 flex flex-col justify-end">
      <button
        aria-label="Close filters"
        onClick={onClose}
        className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm motion-safe:animate-fade-in"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Filter trades"
        className="relative w-full max-h-[85vh] bg-surface-solid backdrop-blur-xl border-t border-surface-border rounded-t-panel shadow-glass motion-safe:animate-slide-up flex flex-col"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-surface-border shrink-0">
          <span className="text-sm font-medium text-ink-primary">Filter trades</span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-2 transition-colors duration-fast"
          >
            <CloseIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">
          <FilterControls
            filters={draft}
            set={setDraftField}
            dropdowns={dropdowns}
            availableTags={availableTags}
            stacked
          />
        </div>

        <div className="flex items-center gap-3 px-5 py-4 border-t border-surface-border shrink-0">
          <button
            type="button"
            onClick={onClear}
            disabled={!draftActive}
            className="text-xs text-ink-secondary hover:text-loss disabled:opacity-40 disabled:hover:text-ink-secondary px-2 py-2"
          >
            Clear all
          </button>
          <button
            type="button"
            onClick={onApply}
            className="flex-1 bg-glow text-surface-0 font-medium text-sm rounded-md py-2.5"
          >
            Apply filters
          </button>
        </div>
      </div>
    </div>
  );
}
