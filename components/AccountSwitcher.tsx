"use client";

import { useState } from "react";
import { useAccount } from "@/lib/AccountContext";

export default function AccountSwitcher() {
  const { accounts, selectedAccount, selectAccount, loading } = useAccount();
  const [open, setOpen] = useState(false);

  if (loading) {
    return (
      <div className="w-40 h-9 rounded-full bg-surface-2 border border-surface-border animate-pulse" />
    );
  }

  if (!selectedAccount) {
    return (
      <span className="text-sm text-ink-muted">No accounts yet</span>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 bg-surface-2 border border-surface-border rounded-full pl-3 pr-2 py-1.5 hover:border-brass-dim transition-colors"
      >
        <span className="signal-bar h-4" />
        <span className="text-sm font-medium max-w-[6rem] sm:max-w-none truncate">
          {selectedAccount.name}
        </span>
        {selectedAccount.is_demo && (
          <span className="text-[11px] uppercase tracking-wide bg-brass/15 text-brass px-2 py-0.5 rounded-full">
            Demo
          </span>
        )}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-ink-muted">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-surface-2 border border-surface-border rounded-card overflow-hidden shadow-lg z-20">
          {accounts.map((acc) => (
            <button
              key={acc.id}
              onClick={() => {
                selectAccount(acc.id);
                setOpen(false);
              }}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between hover:bg-surface-1 transition-colors ${
                acc.id === selectedAccount.id ? "text-brass" : "text-ink-primary"
              }`}
            >
              <span>{acc.name}</span>
              {acc.is_demo && (
                <span className="text-[10px] uppercase text-ink-muted">demo</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
