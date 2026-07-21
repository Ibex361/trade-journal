"use client";

import { DropdownItem } from "@/lib/dropdownSettings";

export type TradeFilters = {
  search: string;
  assetClass: string;
  strategy: string;
  session: string;
  direction: "" | "long" | "short";
  rulesFollowed: "" | "yes" | "no";
  dateFrom: string;
  dateTo: string;
};

export const EMPTY_FILTERS: TradeFilters = {
  search: "",
  assetClass: "",
  strategy: "",
  session: "",
  direction: "",
  rulesFollowed: "",
  dateFrom: "",
  dateTo: "",
};

export function isFiltersActive(f: TradeFilters): boolean {
  return Object.values(f).some((v) => v !== "");
}

const selectClass =
  "bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary";
const labelClass = "text-[11px] text-ink-secondary block mb-1";

export default function TradesFilterBar({
  filters,
  onChange,
  dropdowns,
}: {
  filters: TradeFilters;
  onChange: (f: TradeFilters) => void;
  dropdowns: DropdownItem[];
}) {
  function set<K extends keyof TradeFilters>(key: K, value: TradeFilters[K]) {
    onChange({ ...filters, [key]: value });
  }

  const optionsFor = (category: string) =>
    dropdowns
      .filter((d) => d.category === category)
      .sort((a, b) => a.sort_order - b.sort_order);

  const active = isFiltersActive(filters);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex-1 min-w-[160px]">
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
          <select
            value={filters.assetClass}
            onChange={(e) => set("assetClass", e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            {optionsFor("asset_class").map((o) => (
              <option key={o.id} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>Strategy</span>
          <select
            value={filters.strategy}
            onChange={(e) => set("strategy", e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            {optionsFor("strategy").map((o) => (
              <option key={o.id} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>Session</span>
          <select
            value={filters.session}
            onChange={(e) => set("session", e.target.value)}
            className={selectClass}
          >
            <option value="">All</option>
            {optionsFor("session").map((o) => (
              <option key={o.id} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <span className={labelClass}>Direction</span>
          <div className="flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border">
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
                    ? "bg-brass text-surface-0 font-medium"
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
          <div className="flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border">
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
                    ? "bg-brass text-surface-0 font-medium"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className={labelClass}>From</span>
          <input
            type="date"
            value={filters.dateFrom}
            onChange={(e) => set("dateFrom", e.target.value)}
            className={`${selectClass} font-mono`}
          />
        </div>

        <div>
          <span className={labelClass}>To</span>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => set("dateTo", e.target.value)}
            className={`${selectClass} font-mono`}
          />
        </div>

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
  );
}
