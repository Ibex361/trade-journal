"use client";

import { useState } from "react";
import { DropdownItem } from "@/lib/dropdownSettings";

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
  const [tagToAdd, setTagToAdd] = useState("");
  const [addingTag, setAddingTag] = useState(false);
  const [tagToRemove, setTagToRemove] = useState("");
  const [removingTag, setRemovingTag] = useState(false);
  const [settingRules, setSettingRules] = useState<"yes" | "no" | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleAddTag() {
    if (!tagToAdd) return;
    setAddingTag(true);
    await onAddTag(tagToAdd);
    setAddingTag(false);
    setTagToAdd("");
  }

  async function handleRemoveTag() {
    if (!tagToRemove) return;
    setRemovingTag(true);
    await onRemoveTag(tagToRemove);
    setRemovingTag(false);
    setTagToRemove("");
  }

  async function handleSetRules(value: boolean) {
    setSettingRules(value ? "yes" : "no");
    await onSetRules(value);
    setSettingRules(null);
  }

  async function handleDelete() {
    setDeleting(true);
    await onDelete();
    setDeleting(false);
    setConfirmingDelete(false);
  }

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 border-t border-brass/40 bg-surface-2/95 backdrop-blur supports-[backdrop-filter]:bg-surface-2/80"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-medium text-ink-primary whitespace-nowrap">
            {count} trade{count === 1 ? "" : "s"} selected
          </span>

          <div className="hidden sm:block w-px h-5 bg-surface-border" />

          {tagOptions.length > 0 && (
            <div className="flex items-center gap-1.5">
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

          {removableTags.length > 0 && (
            <div className="flex items-center gap-1.5">
              <select
                value={tagToRemove}
                onChange={(e) => setTagToRemove(e.target.value)}
                className="bg-surface-1 border border-surface-border rounded-md px-2 py-1 text-xs text-ink-primary"
              >
                <option value="">Remove tag…</option>
                {removableTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
              <button
                onClick={handleRemoveTag}
                disabled={!tagToRemove || removingTag}
                className="text-xs text-brass hover:underline disabled:opacity-50 disabled:no-underline"
              >
                {removingTag ? "Removing…" : "Remove"}
              </button>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-ink-secondary whitespace-nowrap">Rules:</span>
            <button
              onClick={() => handleSetRules(true)}
              disabled={settingRules !== null}
              className="text-xs text-gain hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {settingRules === "yes" ? "Setting…" : "Yes"}
            </button>
            <button
              onClick={() => handleSetRules(false)}
              disabled={settingRules !== null}
              className="text-xs text-loss hover:underline disabled:opacity-50 disabled:no-underline"
            >
              {settingRules === "no" ? "Setting…" : "No"}
            </button>
          </div>

          <div className="flex items-center gap-3 sm:ml-auto">
            <button onClick={onExport} className="text-xs text-ink-secondary hover:text-brass whitespace-nowrap">
              Export CSV
            </button>

            {confirmingDelete ? (
              <>
                <span className="text-[11px] text-ink-secondary whitespace-nowrap">
                  Delete {count} trade{count === 1 ? "" : "s"}?
                </span>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="text-xs text-loss font-medium hover:underline disabled:opacity-50 whitespace-nowrap"
                >
                  {deleting ? "Deleting…" : "Confirm"}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="text-xs text-ink-muted hover:text-ink-primary whitespace-nowrap"
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                className="text-xs text-loss/80 hover:text-loss whitespace-nowrap"
              >
                Delete selected
              </button>
            )}
            <button onClick={onClear} className="text-xs text-ink-muted hover:text-ink-primary whitespace-nowrap">
              Clear
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
