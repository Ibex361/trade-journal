"use client";

import { BreakdownGroup, pickWinRate } from "@/lib/metrics";
import { useWinRateMode } from "@/lib/WinRateModeContext";
import Card from "@/components/shared/Card";

type Tone = "good" | "bad" | "neutral";

const TONE_STYLES: Record<Tone, { base: string; selected: string; label: string }> = {
  good: {
    base: "bg-glow/10 border-glow/25 hover:bg-glow/15",
    selected: "border-glow bg-glow/20",
    label: "text-glow",
  },
  bad: {
    base: "bg-loss/10 border-loss/20 hover:bg-loss/15",
    selected: "border-loss bg-loss/20",
    label: "text-loss",
  },
  neutral: {
    base: "border-surface-border hover:bg-surface-2/60",
    selected: "border-glow bg-surface-2",
    label: "text-ink-secondary",
  },
};

function ComparisonColumn({
  group,
  currency,
  tone,
  selected,
  onClick,
}: {
  group: BreakdownGroup;
  currency: string;
  tone: Tone;
  selected: boolean;
  onClick: () => void;
}) {
  const { mode } = useWinRateMode();
  const winRate = pickWinRate(group, mode);
  const pnlColor = group.totalPnl > 0 ? "text-gain" : group.totalPnl < 0 ? "text-loss" : "text-ink-primary";
  const pnlSign = group.totalPnl > 0 ? "+" : "";
  const styles = TONE_STYLES[tone];

  return (
    <button
      onClick={onClick}
      disabled={group.count === 0}
      className={`flex-1 min-w-[160px] text-left rounded-panel border p-4 transition-all duration-fast ${
        selected ? styles.selected : styles.base
      } ${group.count === 0 ? "opacity-50 cursor-default" : "cursor-pointer"}`}
    >
      <p className={`text-xs uppercase tracking-wide font-medium ${styles.label}`}>{group.label}</p>
      <p className="text-ink-muted text-xs mt-0.5">
        {group.count} trade{group.count === 1 ? "" : "s"}
      </p>
      <div className="flex items-center gap-4 mt-3">
        <div>
          <p className="text-[10px] uppercase tracking-wide text-ink-secondary">Win rate</p>
          <p className="font-mono text-sm mt-0.5">{winRate != null ? `${winRate.toFixed(0)}%` : "—"}</p>
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
    winRateStrict: null,
    winRateDecided: null,
    avgR: null,
  });
  const followed = groups.find((g) => g.key === "yes") ?? zero("yes", "Rules followed");
  const notFollowed = groups.find((g) => g.key === "no") ?? zero("no", "Rules not followed");
  const unspecified = groups.find((g) => g.key === "unspecified" && g.count > 0);

  return (
    <Card title="Rules followed vs. not" description="Click a side to see those trades">
      <div className="flex flex-wrap gap-3">
        <ComparisonColumn
          group={followed}
          currency={currency}
          tone="good"
          selected={selectedKey === "yes"}
          onClick={() => followed.count > 0 && onSelectGroup(selectedKey === "yes" ? null : "yes")}
        />
        <ComparisonColumn
          group={notFollowed}
          currency={currency}
          tone="bad"
          selected={selectedKey === "no"}
          onClick={() => notFollowed.count > 0 && onSelectGroup(selectedKey === "no" ? null : "no")}
        />
        {unspecified && (
          <ComparisonColumn
            group={unspecified}
            currency={currency}
            tone="neutral"
            selected={selectedKey === "unspecified"}
            onClick={() => onSelectGroup(selectedKey === "unspecified" ? null : "unspecified")}
          />
        )}
      </div>
    </Card>
  );
}
