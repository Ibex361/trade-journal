"use client";

const MONTH_LABELS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function MonthSelector({
  year,
  month,
  onChange,
}: {
  year: number;
  month: number;
  onChange: (year: number, month: number) => void;
}) {
  function goPrev() {
    if (month === 1) onChange(year - 1, 12);
    else onChange(year, month - 1);
  }
  function goNext() {
    if (month === 12) onChange(year + 1, 1);
    else onChange(year, month + 1);
  }
  function goToday() {
    const now = new Date();
    onChange(now.getFullYear(), now.getMonth() + 1);
  }

  return (
    <div className="inline-flex items-center gap-1 bg-surface-2 border border-surface-border rounded-full p-1">
      <button
        onClick={goPrev}
        aria-label="Previous month"
        className="w-7 h-7 flex items-center justify-center rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface-1 transition-colors"
      >
        ‹
      </button>
      <button
        onClick={goToday}
        className="px-3 py-1 text-xs font-mono text-ink-primary min-w-[110px] text-center hover:text-brass transition-colors"
      >
        {MONTH_LABELS[month - 1]} {year}
      </button>
      <button
        onClick={goNext}
        aria-label="Next month"
        className="w-7 h-7 flex items-center justify-center rounded-full text-ink-secondary hover:text-ink-primary hover:bg-surface-1 transition-colors"
      >
        ›
      </button>
    </div>
  );
}
