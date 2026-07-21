"use client";

import { Trade } from "@/lib/trades";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PnlText({ value }: { value: number }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono ${color}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

export default function BreakdownDrilldown({
  groupLabel,
  trades,
  currency,
  onClose,
}: {
  groupLabel: string;
  trades: Trade[];
  currency: string;
  onClose: () => void;
}) {
  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-display text-sm font-medium">
          {groupLabel} <span className="text-ink-muted font-body font-normal">· {trades.length} trade{trades.length === 1 ? "" : "s"}</span>
        </h3>
        <button
          onClick={onClose}
          className="text-ink-muted hover:text-ink-primary text-xs px-2 py-1 rounded-md hover:bg-surface-2 transition-colors"
        >
          Close ✕
        </button>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-hidden rounded-md border border-surface-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-ink-secondary text-xs uppercase tracking-wide bg-surface-2">
              <th className="px-3 py-2 font-medium">Date</th>
              <th className="px-3 py-2 font-medium">Instrument</th>
              <th className="px-3 py-2 font-medium">Dir</th>
              <th className="px-3 py-2 text-right font-medium">P&amp;L</th>
              <th className="px-3 py-2 text-right font-medium">R</th>
              <th className="px-3 py-2 font-medium">Rules</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-b border-surface-border last:border-0">
                <td className="px-3 py-2 text-ink-secondary">{formatDate(t.entry_date)}</td>
                <td className="px-3 py-2 text-ink-primary">{t.instrument}</td>
                <td className="px-3 py-2 text-ink-secondary capitalize">{t.direction ?? "—"}</td>
                <td className="px-3 py-2 text-right">
                  <PnlText value={t.pnl} />
                </td>
                <td className="px-3 py-2 text-right font-mono text-ink-secondary">
                  {t.r_multiple != null ? t.r_multiple.toFixed(2) : "—"}
                </td>
                <td className="px-3 py-2">
                  {t.rules_followed === null ? (
                    <span className="text-ink-muted text-xs">—</span>
                  ) : t.rules_followed ? (
                    <span className="text-gain text-xs">Yes</span>
                  ) : (
                    <span className="text-loss text-xs">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-2">
        {trades.map((t) => (
          <div key={t.id} className="border border-surface-border rounded-md p-3 flex items-center justify-between">
            <div>
              <p className="text-ink-primary text-sm">{t.instrument}</p>
              <p className="text-ink-muted text-xs mt-0.5">
                {formatDate(t.entry_date)} · <span className="capitalize">{t.direction ?? "—"}</span>
              </p>
            </div>
            <div className="text-right">
              <PnlText value={t.pnl} />
              <p className="text-ink-muted text-xs mt-0.5">
                {t.r_multiple != null ? `${t.r_multiple.toFixed(2)}R` : "—"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
