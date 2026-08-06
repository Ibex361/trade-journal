import type { Note, NoteView, NoteGroupCount } from "@/lib/notes";
import {
  getStrategyGroups,
  getTagGroups,
  getMonthGroups,
  getLinkedTradesCount,
  getUntaggedCount,
  noteViewKey,
} from "@/lib/notes";

const rowBase =
  "w-full flex items-center justify-between gap-2 text-left text-sm px-2.5 py-1.5 rounded-md transition-colors duration-fast";
const rowInactive = "text-ink-secondary hover:text-ink-primary hover:bg-surface-2";
const rowActive = "text-ink-primary bg-surface-2 border border-glow/30";

function NavRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" onClick={onClick} className={`${rowBase} ${active ? rowActive : rowInactive}`}>
      <span className="truncate">{label}</span>
      <span className="text-ink-muted text-xs shrink-0 tabular-nums">{count}</span>
    </button>
  );
}

function SectionLabel({ children }: { children: string }) {
  return <p className="text-ink-muted text-[11px] uppercase tracking-wide px-2.5 mt-4 mb-1 first:mt-0">{children}</p>;
}

function GroupList({
  groups,
  makeView,
  activeKey,
  onSelect,
  emptyLabel,
}: {
  groups: NoteGroupCount[];
  makeView: (key: string) => NoteView;
  activeKey: string;
  onSelect: (view: NoteView) => void;
  emptyLabel: string;
}) {
  if (groups.length === 0) {
    return <p className="text-ink-muted text-xs px-2.5 py-1">{emptyLabel}</p>;
  }
  return (
    <>
      {groups.map((g) => {
        const view = makeView(g.key);
        const key = noteViewKey(view);
        return (
          <NavRow
            key={key}
            label={g.label}
            count={g.count}
            active={activeKey === key}
            onClick={() => onSelect(view)}
          />
        );
      })}
    </>
  );
}

/**
 * Left rail of "smart views" over the flat notes table — no folders, no
 * schema change. Every group here is derived client-side from fields the
 * notes list already fetched (tags, linked_strategy, linked_trade_ids,
 * updated_at), the same way Strategies derives its leaderboard from
 * trades.strategy rather than a separate strategies table.
 */
export default function NotesSidebar({
  notes,
  view,
  onSelectView,
}: {
  notes: Note[];
  view: NoteView;
  onSelectView: (view: NoteView) => void;
}) {
  const activeKey = noteViewKey(view);
  const strategyGroups = getStrategyGroups(notes);
  const tagGroups = getTagGroups(notes);
  const monthGroups = getMonthGroups(notes);
  const linkedTradesCount = getLinkedTradesCount(notes);
  const untaggedCount = getUntaggedCount(notes);

  return (
    <nav className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-3 space-y-0.5 md:w-56 md:shrink-0">
      <NavRow label="All notes" count={notes.length} active={activeKey === "all"} onClick={() => onSelectView("all")} />
      <NavRow
        label="Linked to trades"
        count={linkedTradesCount}
        active={activeKey === "linked-trades"}
        onClick={() => onSelectView("linked-trades")}
      />
      <NavRow
        label="Untagged"
        count={untaggedCount}
        active={activeKey === "untagged"}
        onClick={() => onSelectView("untagged")}
      />

      <SectionLabel>By strategy</SectionLabel>
      <GroupList
        groups={strategyGroups}
        makeView={(strategy) => ({ kind: "strategy", strategy })}
        activeKey={activeKey}
        onSelect={onSelectView}
        emptyLabel="No strategies linked yet"
      />

      <SectionLabel>By tag</SectionLabel>
      <GroupList
        groups={tagGroups}
        makeView={(tag) => ({ kind: "tag", tag })}
        activeKey={activeKey}
        onSelect={onSelectView}
        emptyLabel="No tags yet"
      />

      <SectionLabel>By month</SectionLabel>
      <GroupList
        groups={monthGroups}
        makeView={(month) => ({ kind: "month", month })}
        activeKey={activeKey}
        onSelect={onSelectView}
        emptyLabel="No notes yet"
      />
    </nav>
  );
}
