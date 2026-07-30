"use client";

import { useRef, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { createTrades } from "@/lib/trades";
import { parseTradesCsv, ParsedImport, ImportRowIssue } from "@/lib/csvImport";
import SettingsCard from "./SettingsCard";
import Button from "@/components/shared/Button";

const MAX_VISIBLE_ISSUES = 8;

export default function DataImportCard() {
  const { accounts, selectedAccount } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<string>(selectedAccount?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; accountName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setFileName(null);
    setParsed(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setResult(null);
    setError(null);
    setFileName(file.name);
    if (!targetAccountId && selectedAccount) setTargetAccountId(selectedAccount.id);

    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : "";
      setParsed(parseTradesCsv(text));
    };
    reader.onerror = () => setError("Couldn't read that file. Please try again.");
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!parsed || parsed.trades.length === 0) return;
    const effectiveAccountId = targetAccountId || selectedAccount?.id || accounts[0]?.id;
    const account = accounts.find((a) => a.id === effectiveAccountId);
    if (!account) return;

    setImporting(true);
    setError(null);
    try {
      const { inserted, error: insertError } = await createTrades(account.id, parsed.trades);
      if (insertError) {
        setError(
          inserted > 0
            ? `Imported ${inserted} of ${parsed.trades.length} trades before running into an error. Please check the file and try again for the rest.`
            : "Couldn't import these trades. Please try again."
        );
      } else {
        setResult({ inserted, accountName: account.name });
        setParsed(null);
        setFileName(null);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("handleImport threw:", err);
      setError("Something went wrong importing these trades. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  if (accounts.length === 0) return null;

  const visibleIssues: ImportRowIssue[] = parsed?.issues.slice(0, MAX_VISIBLE_ISSUES) ?? [];
  const hiddenIssueCount = parsed ? Math.max(0, parsed.issues.length - MAX_VISIBLE_ISSUES) : 0;

  return (
    <SettingsCard
      title="Import trades"
      description="Bring in trades from a CSV previously exported from this app (Backup & export, or a Reports monthly export)."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm bg-surface-2 border border-surface-border rounded-full px-4 py-1.5 text-ink-primary hover:border-brass/60 cursor-pointer">
            {fileName ?? "Choose CSV file…"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
          {(fileName || result) && (
            <button onClick={reset} className="text-xs text-ink-muted hover:text-ink-secondary">
              Clear
            </button>
          )}
        </div>

        {parsed && parsed.trades.length > 0 && (
          <div className="bg-surface-2 border border-surface-border rounded-card p-4 space-y-3">
            <p className="text-sm text-ink-primary">
              Found <span className="font-medium">{parsed.trades.length}</span> trade
              {parsed.trades.length === 1 ? "" : "s"} ready to import.
            </p>

            <label className="block max-w-xs">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Import into account</span>
              <select
                value={targetAccountId || selectedAccount?.id || accounts[0]?.id || ""}
                onChange={(e) => setTargetAccountId(e.target.value)}
                className="mt-1 w-full bg-surface-0 border border-surface-border rounded-md px-3 py-2 text-sm"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name}
                  </option>
                ))}
              </select>
            </label>

            {parsed.issues.length > 0 && (
              <div className="text-xs text-ink-muted space-y-1">
                <p>
                  {parsed.issues.length} row{parsed.issues.length === 1 ? "" : "s"} skipped:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {visibleIssues.map((issue, i) => (
                    <li key={i}>
                      {issue.row > 0 ? `Row ${issue.row}: ` : ""}
                      {issue.message}
                    </li>
                  ))}
                </ul>
                {hiddenIssueCount > 0 && <p>…and {hiddenIssueCount} more.</p>}
              </div>
            )}

            <p className="text-xs text-ink-muted">
              Screenshots aren't included in CSV exports, so imported trades won't have one attached — add those back individually if you need them.
            </p>

            {error && <p className="text-xs text-loss">{error}</p>}

            <Button
              onClick={handleImport}
              disabled={importing || !(targetAccountId || selectedAccount?.id || accounts[0]?.id)}
              size="sm"
            >
              {importing ? "Importing…" : `Import ${parsed.trades.length} trade${parsed.trades.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        )}

        {parsed && parsed.trades.length === 0 && (
          <div className="bg-surface-2 border border-surface-border rounded-card p-4 space-y-2">
            <p className="text-sm text-loss">No importable trades found in this file.</p>
            {parsed.issues.length > 0 && (
              <ul className="list-disc list-inside text-xs text-ink-muted space-y-0.5">
                {visibleIssues.map((issue, i) => (
                  <li key={i}>
                    {issue.row > 0 ? `Row ${issue.row}: ` : ""}
                    {issue.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {!parsed && error && <p className="text-xs text-loss">{error}</p>}

        {result && (
          <p className="text-sm text-ink-primary">
            Imported <span className="font-medium">{result.inserted}</span> trade
            {result.inserted === 1 ? "" : "s"} into <span className="font-medium">{result.accountName}</span>.
          </p>
        )}
      </div>
    </SettingsCard>
  );
}
