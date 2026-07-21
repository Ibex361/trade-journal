"use client";

import { useState } from "react";
import { Trade } from "@/lib/trades";
import { tradesToCsv, downloadCsv, slugify } from "@/lib/csvExport";

const MONTH_LABELS = [
  "january", "february", "march", "april", "may", "june",
  "july", "august", "september", "october", "november", "december",
];

export default function ReportsToolbar({
  trades,
  accountName,
  year,
  month,
}: {
  trades: Trade[];
  accountName: string;
  year: number;
  month: number;
}) {
  const [justExported, setJustExported] = useState(false);

  function handleExport() {
    const csv = tradesToCsv(trades);
    const filename = `${slugify(accountName)}-${MONTH_LABELS[month - 1]}-${year}.csv`;
    downloadCsv(csv, filename);
    setJustExported(true);
    setTimeout(() => setJustExported(false), 2000);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="print:hidden flex items-center gap-2">
      <button
        onClick={handleExport}
        disabled={trades.length === 0}
        className="text-sm text-ink-secondary border border-surface-border px-3 py-1.5 rounded-full hover:text-ink-primary hover:border-brass/50 transition-colors disabled:opacity-50 disabled:hover:text-ink-secondary disabled:hover:border-surface-border"
      >
        {justExported ? "Downloaded ✓" : "Export CSV"}
      </button>
      <button
        onClick={handlePrint}
        disabled={trades.length === 0}
        className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full disabled:opacity-50"
      >
        Print report
      </button>
    </div>
  );
}
