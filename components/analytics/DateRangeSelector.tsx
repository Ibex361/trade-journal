"use client";

import { DateRange } from "@/lib/metrics";

const OPTIONS: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "ytd", label: "YTD" },
  { value: "all", label: "All" },
];

export default function DateRangeSelector({
  value,
  onChange,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
}) {
  return (
    <div className="inline-flex items-center bg-surface-2 backdrop-blur-md border border-surface-border rounded-full p-1">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`px-3 py-1 text-xs font-mono rounded-full transition-all duration-fast ease-out ${
            value === opt.value
              ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 font-medium shadow-glow"
              : "text-ink-secondary hover:text-ink-primary"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
