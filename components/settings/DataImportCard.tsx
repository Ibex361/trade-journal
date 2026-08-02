"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { createTrades, getExistingBrokerTickets, TradeInput } from "@/lib/trades";
import { parseTradesCsv } from "@/lib/csvImport";
import { parseExnessCsv } from "@/lib/exnessImport";
import { ParsedImport, ImportRowIssue } from "@/lib/csvUtils";
import SettingsCard from "./SettingsCard";
import Button from "@/components/shared/Button";

const MAX_VISIBLE_ISSUES = 8;

type Source = "app" | "exness";

const SOURCES: { id: Source; label: string; description: string }[] = [
  {
    id: "app",
    label: "This app's export",
    description: "A CSV previously exported from here (Backup & export, or a Reports monthly export).",
  },
  {
    id: "exness",
    label: "Exness",
    description:
      "A trade history CSV exported from Exness (Terminal or Personal Area → History → export). Opening times are read as UTC, exactly as Exness reports them.",
  },
];

export default function DataImportCard() {
  const { accounts, selectedAccount } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [source, setSource] = useState<Source>("app");
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<string>(selectedAccount?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; accountName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trades left to insert after filtering out ones already imported (matched
  // by broker_ticket), and how many were filtered out. Recomputed whenever
  // the parsed file or the target account changes, since "already imported"
  // is specific to that account.
  const [readyTrades, setReadyTrades] = useState<TradeInput[] | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  const effectiveAccountId = targetAccountId || selectedAccount?.id || accounts[0]?.id || "";

  useEffect(() => {
    if (!parsed || parsed.trades.length === 0) {
      setReadyTrades(parsed?.trades ?? null);
      setDuplicateCount(0);
      return;
    }
    if (!effectiveAccountId || !parsed.trades.some((t) => t.broker_ticket)) {
      setReadyTrades(parsed.trades);
      setDuplicateCount(0);
      return;
    }
    let cancelled = false;
    setCheckingDuplicates(true);
    getExistingBrokerTickets(effectiveAccountId).then((existing) => {
      if (cancelled) return;
      const filtered = parsed.trades.filter((t) => !t.broker_ticket || !existing.has(t.broker_ticket));
      setReadyTrades(filtered);
      setDuplicateCount(parsed.trades.length - filtered.length);
      setCheckingDuplicates(false);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed, effectiveAccountId]);

  function reset() {
    setFileName(null);
    setParsed(null);
    setReadyTrades(null);
    setDuplicateCount(0);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSourceChange(next: Source) {
    setSource(next);
    reset();
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
      setParsed(source === "exness" ? parseExnessCsv(text) : parseTradesCsv(text));
    };
    reader.onerror = () => setError("Couldn't read that file. Please try again.");
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!readyTrades || readyTrades.length === 0 || !effectiveAccountId) return;
    const account = accounts.find((a) => a.id === effectiveAccountId);
    if (!account) return;

    setImporting(true);
    setError(null);
    try {
      const { inserted, error: insertError } = await createTrades(account.id, readyTrades);
      if (insertError) {
        setError(
          inserted > 0
            ? `Imported ${inserted} of ${readyTrades.length} trades before running into an error. Please check the file and try again for the rest.`
            : "Couldn't import these trades. Please try again."
        );
      } else {
        setResult({ inserted, accountName: account.name });
        setFileName(null);
        setParsed(null);
        setReadyTrades(null);
        setDuplicateCount(0);
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
  const activeSource = SOURCES.find((s) => s.id === source)!;

  return (
    <SettingsCard title="Import trades" description="Bring in trades from a CSV file.">
      <div className="space-y-4">
        <div className="flex gap-2">
          {SOURCES.map((s) => (
            <button
              key={s.id}
              onClick={() => handleSourceChange(s.id)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                source === s.id
                  ? "border-brass text-ink-primary bg-surface-2"
                  : "border-surface-border text-ink-muted hover:text-ink-secondary"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-muted">{activeSource.description}</p>

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
              {parsed.trades.length === 1 ? "" : "s"} in the file
              {checkingDuplicates
                ? " — checking for ones you've already imported…"
                : duplicateCount > 0
                ? `. ${duplicateCount} already imported into this account, will be skipped.`
                : "."}
            </p>

            <label className="block max-w-xs">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Import into account</span>
              <select
                value={effectiveAccountId}
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
              {source === "exness"
                ? "P&L includes commission and swap. Take-profit, equity, and margin level aren't tracked by this app and are left out. Screenshots aren't part of a broker export, so add those individually if you want them."
                : "Screenshots come along automatically if the file was exported from this app — each trade's screenshot link is restored."}
            </p>

            {error && <p className="text-xs text-loss">{error}</p>}

            {readyTrades && readyTrades.length === 0 && !checkingDuplicates ? (
              <p className="text-sm text-ink-secondary">
                All trades in this file are already in this account — nothing new to import.
              </p>
            ) : (
              <Button onClick={handleImport} disabled={importing || checkingDuplicates || !readyTrades} size="sm">
                {importing
                  ? "Importing…"
                  : checkingDuplicates
                  ? "Checking…"
                  : `Import ${readyTrades?.length ?? parsed.trades.length} trade${
                      (readyTrades?.length ?? parsed.trades.length) === 1 ? "" : "s"
                    }`}
              </Button>
            )}
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
