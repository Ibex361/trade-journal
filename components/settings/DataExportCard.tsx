"use client";

import { useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchTrades, Trade } from "@/lib/trades";
import { tradesToCsv, downloadCsv, slugify } from "@/lib/csvExport";
import { localDateString } from "@/lib/date";
import SettingsCard from "./SettingsCard";
import Button from "@/components/shared/Button";

export default function DataExportCard() {
  const { selectedAccount } = useAccount();
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!selectedAccount) return;
    setExporting(true);
    setError(null);
    const { data, error: fetchError } = await fetchTrades(selectedAccount.id);
    setExporting(false);
    if (fetchError || !data) {
      setError("Couldn't export your trades. Please try again.");
      return;
    }
    const csv = tradesToCsv(data as Trade[]);
    const filename = `${slugify(selectedAccount.name)}-all-trades-${localDateString()}.csv`;
    downloadCsv(csv, filename);
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
