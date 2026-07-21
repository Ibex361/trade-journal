"use client";

import { MonthlyDayPnl } from "@/lib/metrics";

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function cellStyle(pnl: number, count: number, maxAbsPnl: number): React.CSSProperties {
  if (count === 0) return {};
  const intensity = maxAbsPnl > 0 ? Math.min(Math.abs(pnl) / maxAbsPnl, 1) : 0;
  const alpha = 0.12 + intensity * 0.68;
  const [r, g, b] = pnl >= 0 ? [43, 182, 115] : [229, 72, 77]; // gain / loss
  return { backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` };
}

export default function CalendarHeatmap({
  year,
  month,
  days,
  currency,
}: {
  year: number;
  month: number;
  days: MonthlyDayPnl[];
  currency: string;
}) {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0 = Monday
  const cells: (MonthlyDayPnl | null)[] = [...Array(firstDow).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const maxAbsPnl = days.reduce((max, d) => (d.count > 0 ? Math.max(max, Math.abs(d.pnl)) : max), 0);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="mb-4">
        <h2 className="font-display text-base font-medium">Daily P&amp;L</h2>
        <p className="text-ink-muted text-xs mt-0.5">Darker shading means a bigger day, teal for gains and rose for losses</p>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="text-center text-[10px] uppercase tracking-wide text-ink-muted pb-1">
            {label}
          </div>
        ))}
        {cells.map((cell, i) => {
          if (!cell) return <div key={`blank-${i}`} className="aspect-square" />;
          const hasTrades = cell.count > 0;
          const pnlColor = cell.pnl > 0 ? "text-gain" : cell.pnl < 0 ? "text-loss" : "text-ink-muted";
          const title = hasTrades
            ? `${cell.date}: ${cell.pnl >= 0 ? "+" : ""}${cell.pnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} ${currency} · ${cell.count} trade${cell.count === 1 ? "" : "s"}`
            : cell.date;
          return (
            <div
              key={cell.date}
              title={title}
              style={cellStyle(cell.pnl, cell.count, maxAbsPnl)}
              className="aspect-square rounded-md border border-surface-border flex flex-col items-center justify-center gap-0.5 px-1"
            >
              <span className="text-[10px] text-ink-muted leading-none">{cell.day}</span>
              {hasTrades && (
                <span className={`font-mono text-[10px] leading-none ${pnlColor}`}>
                  {cell.pnl >= 0 ? "+" : ""}
                  {cell.pnl.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
