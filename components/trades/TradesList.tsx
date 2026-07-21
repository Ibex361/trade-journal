"use client";

import { useState } from "react";
import { Trade } from "@/lib/trades";

function formatDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function PnlText({ value, className = "" }: { value: number; className?: string }) {
  const color = value > 0 ? "text-gain" : value < 0 ? "text-loss" : "text-ink-secondary";
  const sign = value > 0 ? "+" : "";
  return (
    <span className={`font-mono ${color} ${className}`}>
      {sign}
      {value.toLocaleString(undefined, { maximumFractionDigits: 2 })}
    </span>
  );
}

function DeleteButton({ onConfirm }: { onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <button
          onClick={onConfirm}
          className="text-xs text-loss font-medium hover:underline"
        >
          Confirm
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="text-xs text-ink-muted hover:text-ink-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="text-xs text-ink-muted hover:text-loss"
    >
      Delete
    </button>
  );
}

function RulesBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-ink-muted text-xs">—</span>;
  return value ? (
    <span className="text-gain text-xs">Yes</span>
  ) : (
    <span className="text-loss text-xs">No</span>
  );
}

export default function TradesList({
  trades,
  onEdit,
  onDelete,
}: {
  trades: Trade[];
  onEdit: (trade: Trade) => void;
  onDelete: (id: string) => void;
}) {
  if (trades.length === 0) {
    return (
      <div className="bg-surface-1 border border-surface-border rounded-card p-10 text-center">
        <p className="text-ink-muted text-sm">No trades yet for this account.</p>
      </div>
    );
  }

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block bg-surface-1 border border-surface-border rounded-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-surface-border text-left text-ink-secondary text-xs uppercase tracking-wide">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Instrument</th>
              <th className="px-4 py-3 font-medium">Dir</th>
              <th className="px-4 py-3 font-medium">Asset class</th>
              <th className="px-4 py-3 font-medium">Strategy</th>
              <th className="px-4 py-3 font-medium">Session</th>
              <th className="px-4 py-3 font-medium text-right">P&amp;L</th>
              <th className="px-4 py-3 font-medium text-right">R</th>
              <th className="px-4 py-3 font-medium">Rules</th>
              <th className="px-4 py-3 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr
                key={t.id}
                className="border-b border-surface-border last:border-0 hover:bg-surface-2/50 transition-colors"
              >
                <td className="px-4 py-3 font-mono text-ink-secondary whitespace-nowrap">
                  {formatDate(t.entry_date)}
                </td>
                <td className="px-4 py-3 font-medium">{t.instrument}</td>
                <td className="px-4 py-3 capitalize text-ink-secondary">
                  {t.direction ?? "—"}
                </td>
                <td className="px-4 py-3 text-ink-secondary">{t.asset_class ?? "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{t.strategy ?? "—"}</td>
                <td className="px-4 py-3 text-ink-secondary">{t.session ?? "—"}</td>
                <td className="px-4 py-3 text-right">
                  <PnlText value={t.pnl} />
                </td>
                <td className="px-4 py-3 text-right font-mono text-ink-secondary">
                  {t.r_multiple !== null ? t.r_multiple.toFixed(1) : "—"}
                </td>
                <td className="px-4 py-3">
                  <RulesBadge value={t.rules_followed} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-3">
                    <button
                      onClick={() => onEdit(t)}
                      className="text-xs text-ink-secondary hover:text-brass"
                    >
                      Edit
                    </button>
                    <DeleteButton onConfirm={() => onDelete(t.id)} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {trades.map((t) => (
          <div
            key={t.id}
            className="bg-surface-1 border border-surface-border rounded-card p-4"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="signal-bar h-8" />
                <div>
                  <p className="font-medium">{t.instrument}</p>
                  <p className="text-xs text-ink-secondary font-mono">
                    {formatDate(t.entry_date)} · <span className="capitalize">{t.direction ?? "—"}</span>
                  </p>
                </div>
              </div>
              <PnlText value={t.pnl} className="text-base" />
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ink-secondary">
              {t.asset_class && <span>{t.asset_class}</span>}
              {t.strategy && <span>{t.strategy}</span>}
              {t.session && <span>{t.session}</span>}
              {t.r_multiple !== null && <span className="font-mono">{t.r_multiple.toFixed(1)}R</span>}
              <span className="flex items-center gap-1">
                Rules: <RulesBadge value={t.rules_followed} />
              </span>
            </div>

            <div className="flex items-center justify-end gap-4 mt-3 pt-3 border-t border-surface-border">
              <button
                onClick={() => onEdit(t)}
                className="text-xs text-ink-secondary hover:text-brass"
              >
                Edit
              </button>
              <DeleteButton onConfirm={() => onDelete(t.id)} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
