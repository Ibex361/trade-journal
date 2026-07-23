"use client";

import { useState } from "react";
import { DropdownItem } from "@/lib/dropdownSettings";

function Chip({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "danger" | "positive";
}) {
  const toneClasses =
    tone === "danger"
      ? "border-loss/40 text-loss hover:bg-loss/10"
      : tone === "positive"
      ? "border-gain/40 text-gain hover:bg-gain/10"
      : "border-surface-border text-ink-secondary hover:text-ink-primary hover:bg-surface-1";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`shrink-0 whitespace-nowrap text-xs font-medium border rounded-full px-3 py-1.5 transition-colors disabled:opacity-40 ${toneClasses}`}
    >
      {children}
    </button>
  );
}

export default function BulkActionsBar({
  count,
  tagOptions,
  removableTags,
  onAddTag,
  onRemoveTag,
  onSetRules,
  onExport,
  onDelete,
  onClear,
}: {
  count: number;
  tagOptions: DropdownItem[];
  removableTags: string[];
  onAddTag: (tag: string) => Promise<void>;
  onRemoveTag: (tag: string) => Promise<void>;
  onSetRules: (value: boolean) => Promise<void>;
  onExport: () => void;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const [addTagOpen, setAddTagOpen] = useState(false);
  const [removeTagOpen, setRemoveTagOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  async function handlePickAddTag(tag: string) {
    setAddTagOpen(false);
    if (!tag) return;
    setBusy(true);
    await onAddTag(tag);
    setBusy(false);
  }

  async function handlePickRemoveTag(tag: string) {
    setRemoveTagOpen(false);
    if (!tag) return;
    setBusy(true);
    await onRemoveTag(tag);
    setBusy(false);
  }

  async function handleSetRules(value: boolean) {
    setBusy(true);
    await onSetRules(value);
    setBusy(false);
  }

  async function handleDelete() {
    setBusy(true);
    await onDelete();
    setBusy(false);
    setConfirmingDelete(false);
  }

  return (
    <div className="sticky top-[52px] md:top-[68px] z-20 -mx-4 px-4 md:mx-0 md:px-0 mb-4 pointer-events-none">
      <div className="bg-brass/15 border border-brass/50 rounded-2xl shadow-lg shadow-black/30 pointer-events-auto overflow-hidden ring-1 ring-brass/20 backdrop-blur-sm">
        <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-brass/20">
          <span className="flex items-center gap-2 text-xs font-semibold text-brass tracking-wide">
            <span className="signal-bar h-4" />
            {count} selected
          </span>
          <button
            onClick={onClear}
            className="text-xs text-ink-secondary hover:text-ink-primary font-medium"
          >
            Done
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 pt-2.5 pb-3.5 overflow-x-auto no-scrollbar">
          {tagOptions.length > 0 && (
            <Chip onClick={() => { setAddTagOpen((v) => !v); setRemoveTagOpen(false); }} disabled={busy}>
              + Tag
            </Chip>
          )}

          {removableTags.length > 0 && (
            <Chip onClick={() => { setRemoveTagOpen((v) => !v); setAddTagOpen(false); }} disabled={busy}>
              − Tag
            </Chip>
          )}

          <Chip onClick={() => handleSetRules(true)} disabled={busy} tone="positive">
            Rules ✓
          </Chip>
          <Chip onClick={() => handleSetRules(false)} disabled={busy} tone="danger">
            Rules ✕
          </Chip>

          <div className="w-px h-5 bg-surface-border shrink-0" />

          <Chip onClick={onExport} disabled={busy}>
            Export
          </Chip>

          {confirmingDelete ? (
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] text-ink-secondary whitespace-nowrap">Delete {count}?</span>
              <Chip onClick={handleDelete} disabled={busy} tone="danger">
                Confirm
              </Chip>
              <button
                onClick={() => setConfirmingDelete(false)}
                className="text-xs text-ink-muted hover:text-ink-primary whitespace-nowrap"
              >
                Cancel
              </button>
            </div>
          ) : (
            <Chip onClick={() => setConfirmingDelete(true)} disabled={busy} tone="danger">
              Delete
            </Chip>
          )}
        </div>

        {/* Tag pickers render as an inline panel in normal document flow rather
            than an absolutely-positioned popover — the chip row above scrolls
            horizontally, and an overflow-x-auto container also clips vertical
            overflow, which was cutting the popover off. */}
        {(addTagOpen || removableTags.length > 0 && removeTagOpen) && (
          <div className="border-t border-brass/20 px-4 py-2.5 flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {addTagOpen &&
              tagOptions.map((o) => (
                <button
                  key={o.id}
                  onClick={() => handlePickAddTag(o.value)}
                  className="text-xs text-ink-secondary border border-surface-border rounded-full px-3 py-1 hover:text-ink-primary hover:bg-surface-1"
                >
                  {o.value}
                </button>
              ))}
            {removeTagOpen &&
              removableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handlePickRemoveTag(tag)}
                  className="text-xs text-ink-secondary border border-surface-border rounded-full px-3 py-1 hover:text-ink-primary hover:bg-surface-1"
                >
                  {tag}
                </button>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}
