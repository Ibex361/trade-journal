"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { updateTargets, resetDemoData } from "@/lib/accounts";
import SettingsCard from "./SettingsCard";

export default function TargetsCard() {
  const { selectedAccount, refreshAccounts } = useAccount();
  const [risk, setRisk] = useState("");
  const [monthlyPnl, setMonthlyPnl] = useState("");
  const [winrate, setWinrate] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!selectedAccount) return;
    setRisk(selectedAccount.target_risk_pct?.toString() ?? "");
    setMonthlyPnl(selectedAccount.target_monthly_pnl?.toString() ?? "");
    setWinrate(selectedAccount.target_monthly_winrate?.toString() ?? "");
  }, [selectedAccount?.id]);

  if (!selectedAccount) return null;

  async function handleSave() {
    setSaving(true);
    await updateTargets(selectedAccount!.id, {
      target_risk_pct: risk ? parseFloat(risk) : null,
      target_monthly_pnl: monthlyPnl ? parseFloat(monthlyPnl) : null,
      target_monthly_winrate: winrate ? parseFloat(winrate) : null,
    });
    await refreshAccounts();
    setSaving(false);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  }

  async function handleReset() {
    setResetting(true);
    await resetDemoData();
    setResetting(false);
  }

  return (
    <SettingsCard
      title="Targets"
      description={`Goals for ${selectedAccount.name}, used by Dashboard and Reports.`}
    >
      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className="text-xs text-ink-secondary">Risk per trade (%)</span>
          <input
            type="number"
            value={risk}
            onChange={(e) => setRisk(e.target.value)}
            className="mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-secondary">
            Monthly P&L target ({selectedAccount.currency})
          </span>
          <input
            type="number"
            value={monthlyPnl}
            onChange={(e) => setMonthlyPnl(e.target.value)}
            className="mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
        <label className="block">
          <span className="text-xs text-ink-secondary">Monthly win rate target (%)</span>
          <input
            type="number"
            value={winrate}
            onChange={(e) => setWinrate(e.target.value)}
            className="mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm font-mono"
          />
        </label>
      </div>

      <div className="flex items-center gap-4 mt-5">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full"
        >
          {saving ? "Saving…" : "Save targets"}
        </button>
        {savedFlash && <span className="text-xs text-gain">Saved</span>}
      </div>

      {selectedAccount.is_demo && (
        <div className="mt-6 pt-4 border-t border-surface-border">
          <p className="text-xs text-ink-secondary mb-2">
            Reset this demo account back to its original sample trades.
          </p>
          <button
            onClick={handleReset}
            disabled={resetting}
            className="text-xs text-ink-secondary hover:text-loss border border-surface-border rounded-full px-3 py-1.5"
          >
            {resetting ? "Resetting…" : "Reset demo data"}
          </button>
        </div>
      )}
    </SettingsCard>
  );
}
