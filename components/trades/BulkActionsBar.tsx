"use client";

import { useState } from "react";
import { DropdownItem } from "@/lib/dropdownSettings";

export default function BulkActionsBar({
  count,
  tagOptions,
  onAddTag,
  onDelete,
  onClear,
}: {
  count: number;
  tagOptions: DropdownItem[];
  onAddTag: (tag: string) => Promise<void>;
  onDelete: () => Promise<void>;
  onClear: () => void;
}) {
  const [tagToAdd, setTagToAdd] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleAddTag() {
    if (!tagToAdd) return;
    setAddingTag(true);
    await onAddTag(tagToAdd);
    setAddingTag(false);
    setTagToAdd("");
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirmingDelete(false);
  }

  return (
    <div className="bg-surface-2 border border-brass/40 rounded-card px-4 py-3 flex flex-wrap items-center gap-3">
      <span className="text-xs font-medium text-ink-primary">
        {count} trade{count === 1 ? "" : "s"} selected
      </span>

      {tagOptions.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={tagToAdd}
            onChange={(e) => setTagToAdd(e.target.value)}
            className="bg-surface-1 border border-surface-border rounded-md px-2 py-1 text-xs text-ink-primary"
          >
            <option value="">Add tag…</option>
            {tagOptions.map((o) => (
              <option key={o.id} value={o.value}>
                {o.value}
              </option>
            ))}
          </select>
          <button
            onClick={handleAddTag}
            disabled={!tagToAdd || addingTag}
            className="text-xs text-brass hover:underline disabled:opacity-50 disabled:no-underline"
          >
            {addingTag ? "Adding…" : "Add"}
          </button>
        </div>
      )}

      <div className="flex items-center gap-2 ml-auto">
        {confirmingDelete ? (
          <>
            <span className="text-[11px] text-ink-secondary">Delete {count} trade{count === 1 ? "" : "s"}?</span>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-xs text-loss font-medium hover:underline disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Confirm"}
            </button>
            <button
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              className="text-xs text-ink-muted hover:text-ink-primary"
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirmingDelete(true)}
            className="text-xs text-loss/80 hover:text-loss"
          >
            Delete selected
          </button>
        )}
        <button onClick={onClear} className="text-xs text-ink-muted hover:text-ink-primary">
          Clear selection
        </button>
      </div>
    </div>
  );
}
