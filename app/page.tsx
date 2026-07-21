"use client";

import { useAccount } from "@/lib/AccountContext";

export default function DashboardPage() {
  const { selectedAccount, loading } = useAccount();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-medium tracking-tight">
          Dashboard
        </h1>
        <p className="text-ink-secondary text-sm mt-1">
          Phase 0 — foundation. Real widgets arrive in later phases.
        </p>
      </div>

      <div className="bg-surface-1 border border-surface-border rounded-card p-6">
        {loading ? (
          <p className="text-ink-muted text-sm">Connecting to your database…</p>
        ) : selectedAccount ? (
          <div className="flex items-center gap-4">
            <span className="signal-bar h-10" />
            <div>
              <p className="text-ink-secondary text-sm">Connected account</p>
              <p className="font-display text-xl font-medium">
                {selectedAccount.name}
              </p>
              <p className="font-mono text-sm text-ink-secondary mt-1">
                Starting balance: {selectedAccount.currency}{" "}
                {selectedAccount.starting_balance.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <p className="text-ink-muted text-sm">
            No accounts found yet. Run the schema.sql seed in Supabase.
          </p>
        )}
      </div>
    </div>
  );
}
