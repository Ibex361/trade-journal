"use client";

import { BreakdownGroup } from "@/lib/metrics";

function ComparisonColumn({
  group,
  currency,
  accentClass,
  selected,
  onClick,
}: {
  group: BreakdownGroup;
  currency: string;
  accentClass: string;
  selected: boolean;
  onClick: () => void;
}) {
  const pnlColor = group.totalPnl > 0 ? "text-gain" : group.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = group.totalPnl > 0 ? "+" : "";

  return (
    <button
      onClick={onClick}
      disabled={group.count === 0}
      className={`flex-1 min-w-[160px] text-left rounded-md border p-4 transition-colors ${
        selected ? "border-brass bg-surface-2" : "border-surface-border hover:bg-surface-2/60"
      } ${group.count === 0 ? "opacity-50 cursor-default" : "cursor-pointer"}`}
    >
      <p className={`text-xs uppercase tracking-wide font-medium ${accentClass}`}>{group.label}</p>
      <p className="text-ink-muted text-xs mt-0.5">
        {group.count} trade{group.count === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-4 mt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-secondary">Win rate</p>
          <p className="font-mono text-sm mt-0.5">{group.winRate != null ? `${group.winRate.toFixed(0)}%` : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-secondary">Avg R</p>
          <p className="font-mono text-sm mt-0.5">{group.avgR != null ? group.avgR.toFixed(2) : "—"}</p>
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-secondary">Total P&amp;L</p>
          <p className={`font-mono text-sm mt-0.5 ${pnlColor}`}>
            {pnlSign}
            {group.totalPnl.toLocaleString(undefined, { maximumFractionDigits: 2 })} {currency}
          </p>
        </div>
      </div>
    </button>
  );
}

export default function RulesFollowedComparison({
  groups,
  currency,
  selectedKey,
  onSelectGroup,
}: {
  groups: BreakdownGroup[];
  currency: string;
  selectedKey: string | null;
  onSelectGroup: (key: string | null) => void;
}) {
  const zero = (key: string, label: string): BreakdownGroup => ({
    key,
    label,
    count: 0,
    totalPnl: 0,
    winRate: null,
    avgR: null,
  });
  const followed = groups.find((g) => g.key === "yes") ?? zero("yes", "Rules followed");
  const notFollowed = groups.find((g) => g.key === "no") ?? zero("no", "Rules not followed");
  const unspecified = groups.find((g) => g.key === "unspecified" && g.count > 0);

  return (
    <div className="bg-surface-1 border border-surface-border rounded-card p-5">
      <div className="mb-4">
        <h2 className="font-display text-base font-medium">Rules followed vs. not</h2>
        <p className="text-ink-muted text-xs mt-0.5">Click a side to see those trades</p>
      </div>
      <div className="flex flex-wrap gap-3">
        <ComparisonColumn
          group={followed}
          currency={currency}
          accentClass="text-gain"
          selected={selectedKey === "yes"}
          onClick={() => followed.count > 0 && onSelectGroup(selectedKey === "yes" ? null : "yes")}
        />
        <ComparisonColumn
          group={notFollowed}
          currency={currency}
          accentClass="text-loss"
          selected={selectedKey === "no"}
          onClick={() => notFollowed.count > 0 && onSelectGroup(selectedKey === "no" ? null : "no")}
        />
        {unspecified && (
          <ComparisonColumn
            group={unspecified}
            currency={currency}
            accentClass="text-ink-secondary"
            selected={selectedKey === "unspecified"}
            onClick={() => onSelectGroup(selectedKey === "unspecified" ? null : "unspecified")}
          />
        )}
      </div>
    </div>
  );
}
