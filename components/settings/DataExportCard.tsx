"use client";

import { useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { useTradesData } from "@/lib/TradesDataContext";
import { tradesToCsv, downloadCsv, slugify } from "@/lib/csvExport";
import { localDateString } from "@/lib/date";
import SettingsCard from "./SettingsCard";
import Button from "@/components/shared/Button";

export default function DataExportCard() {
  const { selectedAccount } = useAccount();
  // Reads from the shared trade cache instead of re-fetching the account's
  // entire trade history from Supabase — that data is already loaded and
  // kept live by TradesDataContext (see its docstring), so a fresh
  // `select("*")` here was a duplicate full-history round-trip for data
  // already sitting in memory. Export is now just a client-side serialize,
  // with no network cost and no way to disagree with what's on screen.
  const { trades } = useTradesData();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    if (!selectedAccount) return;
    setExporting(true);
    setError(null);
    try {
      const csv = tradesToCsv(trades);
      const filename = `${slugify(selectedAccount.name)}-all-trades-${localDateString()}.csv`;
      downloadCsv(csv, filename);
    } catch (err) {
      console.error("handleExport failed:", err);
      setError("Couldn't export your trades. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (!selectedAccount) return null;

  return (
    <SettingsCard
      title="Backup & export"
      description="Download every trade on this account as a CSV file — separate from the single-month export on the Reports page."
    >
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? "Preparing export…" : `Export all trades for ${selectedAccount.name}`}
        </Button>
        {error && <p className="text-xs text-loss">{error}</p>}
      </div>
    </SettingsCard>
  );
}
