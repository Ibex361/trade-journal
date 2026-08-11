"use client";

import { useState } from "react";
import { Trade } from "@/lib/trades";
import { tradesToCsv, downloadCsv, slugify } from "@/lib/csvExport";
import Button from "@/components/shared/Button";

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
      <Button variant="secondary" size="sm" onClick={handleExport} disabled={trades.length === 0}>
        {justExported ? "Downloaded ✓" : "Export CSV"}
      </Button>
      <Button size="sm" onClick={handlePrint} disabled={trades.length === 0}>
        Print report
      </Button>
    </div>
  );
}
