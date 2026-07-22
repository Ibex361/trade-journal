"use client";

import { useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { createAccount, renameAccount, updateAccountDetails, archiveAccount, restoreAccount, deleteAccountPermanently } from "@/lib/accounts";
import SettingsCard from "./SettingsCard";

export default function AccountManager() {
  const { accounts, archivedAccounts, refreshAccounts, selectAccount } = useAccount();
  const [showNew, setShowNew] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [editingDetailsId, setEditingDetailsId] = useState<string | null>(null);
  const [editDetailsForm, setEditDetailsForm] = useState({ broker: "", currency: "", starting_balance: "" });
  const [editDetailsError, setEditDetailsError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    broker: "",
    currency: "USD",
    starting_balance: "",
  });

  async function handleCreate() {
    if (!form.name.trim()) return;
    setBusy(true);
    setCreateError(null);
    try {
      const { error } = await createAccount({
        name: form.name.trim(),
        broker: form.broker.trim(),
        currency: form.currency,
        starting_balance: parseFloat(form.starting_balance) || 0,
      });
      if (!error) {
        await refreshAccounts();
        setForm({ name: "", broker: "", currency: "USD", starting_balance: "" });
        setShowNew(false);
      } else {
        setCreateError(error.message);
      }
    } catch (err) {
      console.error("handleCreate threw:", err);
      setCreateError("Something went wrong creating this account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRename(id: string) {
    if (!renameValue.trim()) return;
    setBusy(true);
    setRenameError(null);
    try {
      const { error } = await renameAccount(id, renameValue.trim());
      if (!error) {
        await refreshAccounts();
        setRenamingId(null);
      } else {
        setRenameError(error.message);
      }
    } catch (err) {
      console.error("handleRename threw:", err);
      setRenameError("Something went wrong renaming this account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleEditDetails(id: string) {
    setBusy(true);
    setEditDetailsError(null);
    try {
      const { error } = await updateAccountDetails(id, {
        broker: editDetailsForm.broker.trim(),
        currency: editDetailsForm.currency.trim() || "USD",
        starting_balance: parseFloat(editDetailsForm.starting_balance) || 0,
      });
      if (!error) {
        await refreshAccounts();
        setEditingDetailsId(null);
      } else {
        setEditDetailsError(error.message);
      }
    } catch (err) {
      console.error("handleEditDetails threw:", err);
      setEditDetailsError("Something went wrong updating this account. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function handleArchive(id: string) {
    setBusy(true);
    await archiveAccount(id);
    await refreshAccounts();
    setBusy(false);
  }

  async function handleRestore(id: string) {
    setBusy(true);
    await restoreAccount(id);
    await refreshAccounts();
    setBusy(false);
  }

  async function handleDeletePermanently(id: string) {
    setBusy(true);
    await deleteAccountPermanently(id);
    await refreshAccounts();
    setDeletingId(null);
    setDeleteConfirmText("");
    setBusy(false);
  }

  return (
    <SettingsCard
      title="Accounts"
      description="Every trade, setting, and target belongs to one account."
    >
      <div className="space-y-2">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-surface-2 border border-surface-border rounded-card px-4 py-3"
          >
            <div className="flex items-center justify-between">
              {renamingId === acc.id ? (
                <div className="flex flex-col gap-1.5 flex-1">
                  <div className="flex items-center gap-2">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(e) => {
                        setRenameValue(e.target.value);
                        if (renameError) setRenameError(null);
                      }}
                      className="bg-surface-0 border border-surface-border rounded-md px-2 py-1 text-sm flex-1"
                    />
                    <button
                      onClick={() => handleRename(acc.id)}
                      disabled={busy}
                      className="text-sm text-brass"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setRenamingId(null);
                        setRenameError(null);
                      }}
                      className="text-sm text-ink-muted"
                    >
                      Cancel
                    </button>
                  </div>
                  {renameError && (
                    <p className="text-xs text-loss">{renameError}</p>
                  )}
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{acc.name}</span>
                    {acc.is_demo && (
                      <span className="text-[11px] uppercase tracking-wide bg-brass/15 text-brass px-2 py-0.5 rounded-full">
                        Demo
                      </span>
                    )}
                    <span className="text-xs text-ink-muted font-mono">
                      {acc.currency} {acc.starting_balance.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        setRenamingId(acc.id);
                        setRenameValue(acc.name);
                        setRenameError(null);
                      }}
                      className="text-xs text-ink-secondary hover:text-ink-primary"
                    >
                      Rename
                    </button>
                    <button
                      onClick={() => {
                        if (editingDetailsId === acc.id) {
                          setEditingDetailsId(null);
                        } else {
                          setEditingDetailsId(acc.id);
                          setEditDetailsForm({
                            broker: acc.broker ?? "",
                            currency: acc.currency,
                            starting_balance: String(acc.starting_balance),
                          });
                          setEditDetailsError(null);
                        }
                      }}
                      className="text-xs text-ink-secondary hover:text-ink-primary"
                    >
                      {editingDetailsId === acc.id ? "Close" : "Edit"}
                    </button>
                    {!acc.is_demo && (
                      <button
                        onClick={() => handleArchive(acc.id)}
                        disabled={busy}
                        className="text-xs text-loss/80 hover:text-loss"
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {editingDetailsId === acc.id && (
              <div className="mt-3 pt-3 border-t border-surface-border space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <input
                    placeholder="Broker (optional)"
                    value={editDetailsForm.broker}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, broker: e.target.value })}
                    className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Currency (e.g. USD)"
                    value={editDetailsForm.currency}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, currency: e.target.value })}
                    className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Starting balance"
                    type="number"
                    value={editDetailsForm.starting_balance}
                    onChange={(e) => setEditDetailsForm({ ...editDetailsForm, starting_balance: e.target.value })}
                    className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
                  />
                </div>
                <p className="text-xs text-ink-muted">
                  Changing starting balance recalculates this account's equity curve and returns from that new baseline.
                </p>
                {editDetailsError && <p className="text-xs text-loss">{editDetailsError}</p>}
                <div className="flex gap-3">
                  <button
                    onClick={() => handleEditDetails(acc.id)}
                    disabled={busy}
                    className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full"
                  >
                    Save changes
                  </button>
                  <button
                    onClick={() => {
                      setEditingDetailsId(null);
                      setEditDetailsError(null);
                    }}
                    className="text-sm text-ink-muted"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {showNew ? (
        <div className="mt-4 bg-surface-2 border border-surface-border rounded-card p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input
              placeholder="Account name"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (createError) setCreateError(null);
              }}
              className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Broker (optional)"
              value={form.broker}
              onChange={(e) => setForm({ ...form, broker: e.target.value })}
              className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Currency (e.g. USD)"
              value={form.currency}
              onChange={(e) => setForm({ ...form, currency: e.target.value })}
              className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm"
            />
            <input
              placeholder="Starting balance"
              type="number"
              value={form.starting_balance}
              onChange={(e) => setForm({ ...form, starting_balance: e.target.value })}
              className="bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
            />
          </div>
          {createError && <p className="text-xs text-loss">{createError}</p>}
          <div className="flex gap-3">
            <button
              onClick={handleCreate}
              disabled={busy}
              className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full"
            >
              Create account
            </button>
            <button
              onClick={() => {
                setShowNew(false);
                setCreateError(null);
              }}
              className="text-sm text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowNew(true)}
          className="mt-4 text-sm text-brass hover:text-brass-dim"
        >
          + Add account
        </button>
      )}

      {archivedAccounts.length > 0 && (
        <div className="mt-6 pt-4 border-t border-surface-border">
          <button
            onClick={() => setShowArchived((s) => !s)}
            className="text-xs text-ink-muted hover:text-ink-secondary"
          >
            {showArchived ? "Hide" : "Show"} archived accounts ({archivedAccounts.length})
          </button>
          {showArchived && (
            <div className="mt-3 space-y-2">
              {archivedAccounts.map((acc) => (
                <div
                  key={acc.id}
                  className="bg-surface-2/50 border border-surface-border rounded-card px-4 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-ink-muted">{acc.name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleRestore(acc.id)}
                        disabled={busy}
                        className="text-xs text-brass"
                      >
                        Restore
                      </button>
                      <button
                        onClick={() => {
                          setDeletingId(deletingId === acc.id ? null : acc.id);
                          setDeleteConfirmText("");
                        }}
                        className="text-xs text-loss/80 hover:text-loss"
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                  {deletingId === acc.id && (
                    <div className="mt-3 pt-3 border-t border-surface-border">
                      <p className="text-xs text-loss mb-2">
                        This deletes "{acc.name}" and every trade in it, forever.
                        Type the account name to confirm.
                      </p>
                      <div className="flex gap-2">
                        <input
                          value={deleteConfirmText}
                          onChange={(e) => setDeleteConfirmText(e.target.value)}
                          placeholder={acc.name}
                          className="bg-surface-0 border border-surface-border rounded-md px-2 py-1 text-sm flex-1"
                        />
                        <button
                          onClick={() => handleDeletePermanently(acc.id)}
                          disabled={busy || deleteConfirmText !== acc.name}
                          className="text-xs bg-loss text-surface-0 font-medium px-3 py-1.5 rounded-full disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                          Confirm delete
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </SettingsCard>
  );
}
