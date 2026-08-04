"use client";

import { useEffect, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import Card from "@/components/shared/Card";
import Button from "@/components/shared/Button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import NoteEditor from "@/components/notes/NoteEditor";
import LinkedTradesPicker from "@/components/notes/LinkedTradesPicker";
import { useAccount } from "@/lib/AccountContext";
import { fetchDropdownItems, type DropdownItem } from "@/lib/dropdownSettings";
import type { Note } from "@/lib/notes";
import type { Trade } from "@/lib/trades";

/**
 * Phase 1c part 2 adds Delete (with a ConfirmDialog, same component the
 * Trades page's delete flow uses) on top of part 1's open/edit/save.
 *
 * Phase 3 part 1 adds a tag picker — same chip-toggle UX as
 * TradeFormPanel's tag section, reusing the same account-wide "tag"
 * dropdown vocabulary (Settings → Tags) rather than a notes-only list, so
 * a tag means the same thing on a trade or a note. Fetches its own
 * dropdown items independently (TradeFormPanel does the same), rather than
 * threading them down from app/notes/page.tsx.
 *
 * Phase 3 part 3 adds optional linking: a "Linked strategy" select (same
 * `renderOptions`-style orphan handling TradeFormPanel uses for its own
 * strategy field, since a note can reference a strategy that's since been
 * removed from Settings) and a LinkedTradesPicker for linking one or more
 * trades. `trades` is threaded down from app/notes/page.tsx's
 * useTradesData() call rather than fetched here, since the full account
 * trade list is already cached there.
 *
 * Dirty tracking is intentionally simple (title/content/tags/links changed
 * since last save) rather than a full undo-aware diff — good enough to
 * decide whether "Close" should warn.
 */
export default function NoteEditPanel({
  note,
  trades,
  saving,
  deleting,
  onSave,
  onDelete,
  onClose,
}: {
  note: Note;
  trades: Trade[];
  saving: boolean;
  deleting: boolean;
  onSave: (title: string, content: JSONContent, tags: string[], linkedTradeIds: string[], linkedStrategy: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { selectedAccount } = useAccount();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent | null>(note.content);
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [linkedTradeIds, setLinkedTradeIds] = useState<string[]>(note.linked_trade_ids ?? []);
  const [linkedStrategy, setLinkedStrategy] = useState<string>(note.linked_strategy ?? "");
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  useEffect(() => {
    if (!selectedAccount) return;
    fetchDropdownItems(selectedAccount.id).then(({ data }) => {
      if (data) setDropdowns(data as DropdownItem[]);
    });
  }, [selectedAccount?.id]);

  const tagOptions = dropdowns
    .filter((d) => d.category === "tag")
    .sort((a, b) => a.sort_order - b.sort_order);
  // A tag on this note that's since been removed from Settings — kept
  // selectable (dashed style) rather than silently dropped, same treatment
  // TradeFormPanel gives orphaned tags.
  const orphanedTags = tags.filter((t) => !tagOptions.some((o) => o.value === t));

  const strategyOptions = dropdowns
    .filter((d) => d.category === "strategy")
    .sort((a, b) => a.sort_order - b.sort_order);
  // Same orphan treatment as tags above — a linked strategy that's since
  // been removed from Settings stays selected rather than silently
  // clearing, so saving the note again doesn't quietly drop it.
  const strategyIsOrphaned = linkedStrategy !== "" && !strategyOptions.some((o) => o.value === linkedStrategy);

  function handleTitleChange(value: string) {
    setTitle(value);
    setDirty(true);
  }

  function handleContentChange(value: JSONContent) {
    setContent(value);
    setDirty(true);
  }

  function toggleTag(value: string) {
    setTags((current) => (current.includes(value) ? current.filter((t) => t !== value) : [...current, value]));
    setDirty(true);
  }

  function handleLinkedTradeIdsChange(ids: string[]) {
    setLinkedTradeIds(ids);
    setDirty(true);
  }

  function handleLinkedStrategyChange(value: string) {
    setLinkedStrategy(value);
    setDirty(true);
  }

  function handleSave() {
    onSave(
      title.trim() || "Untitled",
      content ?? { type: "doc", content: [{ type: "paragraph" }] },
      tags,
      linkedTradeIds,
      linkedStrategy || null
    );
    setDirty(false);
  }

  function handleClose() {
    if (dirty && !window.confirm("You have unsaved changes. Close without saving?")) return;
    onClose();
  }

  return (
    <>
      <Card padding="tight" className="space-y-4 border-glow/40">
        <div className="flex items-start justify-between gap-3">
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            className="flex-1 bg-transparent font-display text-lg font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
            placeholder="Note title"
          />
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)} disabled={saving || deleting}>
              {deleting ? "Deleting…" : "Delete"}
            </Button>
            <Button variant="secondary" size="sm" onClick={handleClose} disabled={deleting}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!dirty || saving || deleting}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </div>

        {(tagOptions.length > 0 || orphanedTags.length > 0) && (
          <div>
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Tags</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {tagOptions.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggleTag(o.value)}
                  className={`px-3 py-1 rounded-full text-xs border transition-colors duration-fast ${
                    tags.includes(o.value)
                      ? "bg-glow/15 border-glow text-glow"
                      : "border-surface-border text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {o.value}
                </button>
              ))}
              {orphanedTags.map((t) => (
                <button
                  key={`orphan-${t}`}
                  type="button"
                  onClick={() => toggleTag(t)}
                  title="Removed from Settings — click to remove it from this note"
                  className="px-3 py-1 rounded-full text-xs border border-dashed border-surface-border text-ink-muted hover:text-ink-primary"
                >
                  {t} (removed from list)
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <span className="text-[11px] uppercase tracking-wide text-ink-muted">Linked strategy</span>
            <select
              value={linkedStrategy}
              onChange={(e) => handleLinkedStrategyChange(e.target.value)}
              className="mt-1.5 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-xs text-ink-primary focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20 transition-colors"
            >
              <option value="">—</option>
              {strategyOptions.map((o) => (
                <option key={o.id} value={o.value}>
                  {o.value}
                </option>
              ))}
              {strategyIsOrphaned && (
                <option value={linkedStrategy} style={{ color: "#8a8f98" }}>
                  {linkedStrategy} (removed from list)
                </option>
              )}
            </select>
          </div>

          <LinkedTradesPicker trades={trades} linkedTradeIds={linkedTradeIds} onChange={handleLinkedTradeIdsChange} />
        </div>

        <NoteEditor content={content} onChange={handleContentChange} placeholder="Start writing…" />
      </Card>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this note?"
        description={`"${title || "Untitled"}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
