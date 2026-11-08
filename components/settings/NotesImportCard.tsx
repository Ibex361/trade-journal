"use client";

import { useEffect, useRef, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { createNotes, getExistingNoteHashes, getExistingTradeIds, NoteInput } from "@/lib/notes";
import { parseNotesJson, filterDuplicateNotes, ParsedNotesImport } from "@/lib/notesImport";
import SettingsCard from "./SettingsCard";
import Button from "@/components/shared/Button";
import { Select } from "@/components/shared/Select";

const MAX_VISIBLE_ISSUES = 8;

export default function NotesImportCard() {
  const { accounts, selectedAccount } = useAccount();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedNotesImport | null>(null);
  const [targetAccountId, setTargetAccountId] = useState<string>(selectedAccount?.id ?? "");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ inserted: number; accountName: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Notes left to insert after two filters, both re-run whenever the
  // parsed file or the target account changes (same reasoning as
  // DataImportCard's readyTrades): duplicate detection and trade-link
  // validity are both specific to whichever account is currently selected
  // as the import target.
  const [readyNotes, setReadyNotes] = useState<NoteInput[] | null>(null);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [droppedLinkCount, setDroppedLinkCount] = useState(0);
  const [checking, setChecking] = useState(false);

  const effectiveAccountId = targetAccountId || selectedAccount?.id || accounts[0]?.id || "";

  useEffect(() => {
    if (!parsed || parsed.notes.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setReadyNotes(parsed?.notes ?? null);
      setDuplicateCount(0);
      setDroppedLinkCount(0);
      return;
    }
    if (!effectiveAccountId) {
      setReadyNotes(parsed.notes);
      setDuplicateCount(0);
      setDroppedLinkCount(0);
      return;
    }
    let cancelled = false;
    setChecking(true);
    Promise.all([getExistingNoteHashes(effectiveAccountId), getExistingTradeIds(effectiveAccountId)]).then(
      ([existingHashes, existingTradeIds]) => {
        if (cancelled) return;
        const { ready: deduped, duplicateCount: dupCount } = filterDuplicateNotes(parsed.notes, existingHashes);

        // Trade links are only meaningful within the account they were
        // created in (see notesImport.ts) — drop any that don't resolve
        // in the target account rather than importing a dangling id.
        let dropped = 0;
        const withValidLinks = deduped.map((note) => {
          if (note.linked_trade_ids.length === 0) return note;
          const filteredLinks = note.linked_trade_ids.filter((id) => existingTradeIds.has(id));
          if (filteredLinks.length !== note.linked_trade_ids.length) dropped++;
          return filteredLinks.length === note.linked_trade_ids.length
            ? note
            : { ...note, linked_trade_ids: filteredLinks };
        });

        setReadyNotes(withValidLinks);
        setDuplicateCount(dupCount);
        setDroppedLinkCount(dropped);
        setChecking(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [parsed, effectiveAccountId]);

  function reset() {
    setFileName(null);
    setParsed(null);
    setReadyNotes(null);
    setDuplicateCount(0);
    setDroppedLinkCount(0);
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
      setParsed(parseNotesJson(text));
    };
    reader.onerror = () => setError("Couldn't read that file. Please try again.");
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!readyNotes || readyNotes.length === 0 || !effectiveAccountId) return;
    const account = accounts.find((a) => a.id === effectiveAccountId);
    if (!account) return;

    setImporting(true);
    setError(null);
    try {
      const { inserted, error: insertError } = await createNotes(account.id, readyNotes);
      if (insertError) {
        setError(
          inserted > 0
            ? `Imported ${inserted} of ${readyNotes.length} notes before running into an error. Please check the file and try again for the rest.`
            : "Couldn't import these notes. Please try again."
        );
      } else {
        setResult({ inserted, accountName: account.name });
        setFileName(null);
        setParsed(null);
        setReadyNotes(null);
        setDuplicateCount(0);
        setDroppedLinkCount(0);
        if (fileInputRef.current) fileInputRef.current.value = "";
        // Notes has no shared cache to refresh (see NotesExportCard) —
        // navigating to the Notes page re-fetches on mount regardless.
      }
    } catch (err) {
      console.error("handleImport (notes) threw:", err);
      setError("Something went wrong importing these notes. Please try again.");
    } finally {
      setImporting(false);
    }
  }

  if (accounts.length === 0) return null;

  const visibleIssues = parsed?.issues.slice(0, MAX_VISIBLE_ISSUES) ?? [];
  const hiddenIssueCount = parsed ? Math.max(0, parsed.issues.length - MAX_VISIBLE_ISSUES) : 0;

  return (
    <SettingsCard
      title="Import notes"
      description="Bring in notes from a JSON file previously exported from this app (Backup & export notes above)."
    >
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <label className="text-sm bg-surface-2 border border-surface-border rounded-full px-4 py-1.5 text-ink-primary hover:border-glow/60 cursor-pointer">
            {fileName ?? "Choose JSON file…"}
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
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

        {parsed && parsed.notes.length > 0 && (
          <div className="bg-surface-2 border border-surface-border rounded-card p-4 space-y-3">
            <p className="text-sm text-ink-primary">
              Found <span className="font-medium">{parsed.notes.length}</span> note
              {parsed.notes.length === 1 ? "" : "s"} in the file
              {checking
                ? " — checking for ones you've already imported…"
                : duplicateCount > 0
                ? `. ${duplicateCount} already imported into this account, will be skipped.`
                : "."}
            </p>

            <label className="block max-w-xs">
              <span className="text-xs uppercase tracking-wide text-ink-muted">Import into account</span>
              <Select
                value={effectiveAccountId}
                onChange={setTargetAccountId}
                options={accounts.map((acc) => ({ value: acc.id, label: acc.name }))}
                fullWidth
                className="mt-1"
              />
            </label>

            {!checking && droppedLinkCount > 0 && (
              <p className="text-xs text-ink-muted">
                {droppedLinkCount} note{droppedLinkCount === 1 ? "" : "s"} linked to trades that don&apos;t exist in
                this account — the note{droppedLinkCount === 1 ? "" : "s"} will still import, just without that link.
              </p>
            )}

            {parsed.issues.length > 0 && (
              <div className="text-xs text-ink-muted space-y-1">
                <p>
                  {parsed.issues.length} entr{parsed.issues.length === 1 ? "y" : "ies"} skipped:
                </p>
                <ul className="list-disc list-inside space-y-0.5">
                  {visibleIssues.map((issue, i) => (
                    <li key={i}>
                      {issue.row > 0 ? `Note ${issue.row}: ` : ""}
                      {issue.message}
                    </li>
                  ))}
                </ul>
                {hiddenIssueCount > 0 && <p>…and {hiddenIssueCount} more.</p>}
              </div>
            )}

            {error && <p className="text-xs text-loss">{error}</p>}

            {readyNotes && readyNotes.length === 0 && !checking ? (
              <p className="text-sm text-ink-secondary">
                All notes in this file are already in this account — nothing new to import.
              </p>
            ) : (
              <Button onClick={handleImport} disabled={importing || checking || !readyNotes} size="sm">
                {importing
                  ? "Importing…"
                  : checking
                  ? "Checking…"
                  : `Import ${readyNotes?.length ?? parsed.notes.length} note${
                      (readyNotes?.length ?? parsed.notes.length) === 1 ? "" : "s"
                    }`}
              </Button>
            )}
          </div>
        )}

        {parsed && parsed.notes.length === 0 && (
          <div className="bg-surface-2 border border-surface-border rounded-card p-4 space-y-2">
            <p className="text-sm text-loss">No importable notes found in this file.</p>
            {parsed.issues.length > 0 && (
              <ul className="list-disc list-inside text-xs text-ink-muted space-y-0.5">
                {visibleIssues.map((issue, i) => (
                  <li key={i}>
                    {issue.row > 0 ? `Note ${issue.row}: ` : ""}
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
            Imported <span className="font-medium">{result.inserted}</span> note
            {result.inserted === 1 ? "" : "s"} into <span className="font-medium">{result.accountName}</span>.
          </p>
        )}
      </div>
    </SettingsCard>
  );
}
