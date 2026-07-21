"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import {
  fetchDropdownItems,
  addDropdownItem,
  deleteDropdownItem,
  reorderDropdownItem,
  DropdownItem,
  DropdownCategory,
} from "@/lib/dropdownSettings";
import SettingsCard from "./SettingsCard";

const CATEGORIES: { key: DropdownCategory; label: string }[] = [
  { key: "asset_class", label: "Asset class" },
  { key: "strategy", label: "Strategy" },
  { key: "session", label: "Session" },
  { key: "emotion", label: "Emotion" },
  { key: "tag", label: "Tags" },
];

export default function DropdownLists() {
  const { selectedAccount } = useAccount();
  const [items, setItems] = useState<DropdownItem[]>([]);
  const [activeTab, setActiveTab] = useState<DropdownCategory>("asset_class");
  const [newValue, setNewValue] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!selectedAccount) return;
    setLoading(true);
    const { data } = await fetchDropdownItems(selectedAccount.id);
    if (data) setItems(data as DropdownItem[]);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  const activeItems = items
    .filter((i) => i.category === activeTab)
    .sort((a, b) => a.sort_order - b.sort_order);

  async function handleAdd() {
    if (!selectedAccount || !newValue.trim()) return;
    const nextOrder =
      activeItems.length > 0 ? Math.max(...activeItems.map((i) => i.sort_order)) + 1 : 1;
    await addDropdownItem(selectedAccount.id, activeTab, newValue.trim(), nextOrder);
    setNewValue("");
    load();
  }

  async function handleDelete(id: string) {
    await deleteDropdownItem(id);
    load();
  }

  async function handleMove(item: DropdownItem, direction: -1 | 1) {
    const idx = activeItems.findIndex((i) => i.id === item.id);
    const swapWith = activeItems[idx + direction];
    if (!swapWith) return;
    await reorderDropdownItem(item.id, swapWith.sort_order);
    await reorderDropdownItem(swapWith.id, item.sort_order);
    load();
  }

  return (
    <SettingsCard
      title="Dropdown lists"
      description="These options power the fields on every trade entry, per account."
    >
      <div className="flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border mb-4 w-fit">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveTab(cat.key)}
            className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
              activeTab === cat.key
                ? "bg-brass text-surface-0 font-medium"
                : "text-ink-secondary hover:text-ink-primary"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-ink-muted">Loading…</p>
      ) : (
        <div className="space-y-2">
          {activeItems.map((item, idx) => (
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
                  disabled={idx === activeItems.length - 1}
                  className="text-ink-muted hover:text-ink-primary disabled:opacity-30 text-xs"
                >
                  ↓
                </button>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="text-xs text-loss/80 hover:text-loss"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          {activeItems.length === 0 && (
            <p className="text-sm text-ink-muted">No items yet in this list.</p>
          )}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <input
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="Add new item…"
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
