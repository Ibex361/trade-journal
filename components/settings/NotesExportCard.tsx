"use client";

import { useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchNotes } from "@/lib/notes";
import { notesToExportFile, downloadNotesJson } from "@/lib/notesExport";
import { slugify } from "@/lib/csvExport";
import { localDateString } from "@/lib/date";
import SettingsCard from "./SettingsCard";
import Button from "@/components/shared/Button";

export default function NotesExportCard() {
  const { selectedAccount } = useAccount();
  // No shared notes cache exists at Settings' level (unlike trades' shared
  // TradesDataContext — see DataExportCard) — the Notes page fetches its
  // own notes locally in app/notes/page.tsx and doesn't expose them via
  // context, so a direct fetch here is the only option, not a duplicate of
  // something already in memory.
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleExport() {
    if (!selectedAccount) return;
    setExporting(true);
    setError(null);
    try {
      const { data, error: fetchError } = await fetchNotes(selectedAccount.id);
      if (fetchError) throw fetchError;
      const file = notesToExportFile(data ?? [], selectedAccount.name);
      const filename = `${slugify(selectedAccount.name)}-notes-${localDateString()}.json`;
      downloadNotesJson(file, filename);
    } catch (err) {
      console.error("handleExport (notes) failed:", err);
      setError("Couldn't export your notes. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  if (!selectedAccount) return null;

  return (
    <SettingsCard
      title="Backup & export notes"
      description="Download every diary note on this account as a JSON file — preserves rich text, tags, and links exactly."
    >
      <div className="flex items-center gap-3">
        <Button variant="secondary" size="sm" onClick={handleExport} disabled={exporting}>
          {exporting ? "Preparing export…" : `Export all notes for ${selectedAccount.name}`}
        </Button>
        {error && <p className="text-xs text-loss">{error}</p>}
      </div>
    </SettingsCard>
  );
}
