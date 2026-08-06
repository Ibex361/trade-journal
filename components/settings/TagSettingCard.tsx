"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import {
  fetchTagSettings,
  addTagSetting,
  deleteTagSetting,
  reorderTagSetting,
  getTagUsageCount,
  TagSettingItem,
} from "@/lib/tagSettings";
import SettingsCard from "./SettingsCard";

/**
 * "Tag setting" — dedicated account-wide tag vocabulary management,
 * decoupled from the generic Dropdown lists card (which now only handles
 * asset_class/strategy/session/emotion). Backed by the tag_settings table.
 *
 * Part 1: this card manages tag_settings directly. TradeFormPanel/
 * NoteEditPanel/the filter bars still read tags from dropdown_settings'
 * 'tag' category for now — part 2 switches them over and safely removes
 * that category from dropdown_settings.
 */

function RemoveButton({
  item,
  accountId,
  onRemoved,
}: {
  item: TagSettingItem;
  accountId: string;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [checkingCount, setCheckingCount] = useState(false);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [removing, setRemoving] = useState(false);

  async function startConfirm() {
    setConfirming(true);
    setCheckingCount(true);
    const count = await getTagUsageCount(accountId, item.value);
    setUsageCount(count);
    setCheckingCount(false);
  }

  function cancel() {
    setConfirming(false);
    setUsageCount(null);
  }

  async function confirmRemove() {
    setRemoving(true);
    await deleteTagSetting(item.id);
    setRemoving(false);
    onRemoved();
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        {checkingCount ? (
          <span className="text-[11px] text-ink-muted">Checking…</span>
        ) : (
          <span className="text-[11px] text-ink-secondary">
            {usageCount && usageCount > 0
              ? `Used by ${usageCount} trade${usageCount === 1 ? "" : "s"}/note${usageCount === 1 ? "" : "s"} — they'll keep it, it just won't be pickable for new ones.`
              : "Remove this tag?"}
          </span>
        )}
        <button
          onClick={confirmRemove}
          disabled={checkingCount || removing}
          className="text-xs text-loss font-medium hover:underline disabled:opacity-50"
        >
          {removing ? "Removing…" : "Confirm"}
        </button>
        <button
          onClick={cancel}
          disabled={removing}
          className="text-xs text-ink-muted hover:text-ink-primary"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={startConfirm} className="text-xs text-loss/80 hover:text-loss">
      Remove
    </button>
  );
}

export default function TagSettingCard() {
  const { selectedAccount } = useAccount();
  const [items, setItems] = useState<TagSettingItem[]>([]);
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const { data } = await fetchTagSettings(selectedAccount.id);
    if (data) setItems(data as TagSettingItem[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  const sortedItems = [...items].sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd() {
    if (!selectedAccount || !newValue.trim()) return;
    const trimmed = newValue.trim();
    if (sortedItems.some((i) => i.value.toLowerCase() === trimmed.toLowerCase())) {
      setNewValue("");
      return;
    }
    const nextOrder = sortedItems.length > 0 ? Math.max(...sortedItems.map((i) => i.sort_order)) + 1 : 1;
    await addTagSetting(selectedAccount.id, trimmed, nextOrder);
    setNewValue("");
    load();
  }

  async function handleMove(item: TagSettingItem, direction: -1 | 1) {
    const idx = sortedItems.findIndex((i) => i.id === item.id);
    const swapWith = sortedItems[idx + direction];
    if (!swapWith) return;
    await reorderTagSetting(item.id, swapWith.sort_order);
    await reorderTagSetting(swapWith.id, item.sort_order);
    load();
  }

  return (
    <SettingsCard
      title="Tag setting"
      description="Manage the account-wide tag vocabulary used across trades and notes."
    >
      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {sortedItems.map((item, idx) => (
            <div
              key={item.id}
              className="flex items-center justify-between bg-surface-2 border border-surface-border rounded-md px-3 py-2"
            >
              <span className="text-sm">{item.value}</span>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleMove(item, -1)}
                  disabled={idx === 0}
                  className="text-ink-muted hover:text-ink-primary disabled:opacity-30 text-xs"
                >
                  ↑
                </button>
                <button
                  onClick={() => handleMove(item, 1)}
                  disabled={idx === sortedItems.length - 1}
                  className="text-ink-muted hover:text-ink-primary disabled:opacity-30 text-xs"
                >
                  ↓
                </button>
                {selectedAccount && (
                  <RemoveButton item={item} accountId={selectedAccount.id} onRemoved={load} />
                )}
              </div>
            </div>
          ))}
          {sortedItems.length === 0 && (
            <p className="text-sm text-ink-muted">No tags yet — tags you type on a trade or note will still save even if they're not listed here.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add a tag…"
          className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm flex-1"
        />
        <button
          onClick={handleAdd}
          className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full"
        >
          Add
        </button>
      </div>
    </SettingsCard>
  );
}
