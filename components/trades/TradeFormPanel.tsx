"use client";

import { useTradeForm } from "@/hooks/useTradeForm";
import { Trade } from "@/lib/trades";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { NotesIcon } from "@/components/icons";
import TradeFormFields from "./trade-form/TradeFormFields";

/**
 * Slide-over panel for creating, editing, or duplicating a trade. All the
 * state, effects, and save logic live in useTradeForm — this component is
 * just the shell (backdrop, header, discard-confirm dialog) plus
 * TradeFormFields for the actual form markup. Previously a single
 * 1000+ line component; see useTradeForm's docstring and the
 * trade-journal-webapp memory for why it was split.
 */
export default function TradeFormPanel({
  trade,
  duplicateFrom,
  onClose,
  onSaved,
  onOpenDiary,
  openingDiary,
}: {
  trade: Trade | null;
  duplicateFrom?: Trade | null;
  onClose: () => void;
  onSaved: (savedTrade: Trade) => void;
  // Only meaningful for an existing trade (a brand-new/duplicated trade
  // has no id yet to link a diary entry to) — see app/trades/page.tsx's
  // handleOpenDiary for what this actually does (find-or-create the
  // linked note, then redirect to Notes).
  onOpenDiary?: (trade: Trade) => void;
  openingDiary?: boolean;
}) {
  const f = useTradeForm({ trade, duplicateFrom, onClose, onSaved, onOpenDiary });

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div className="absolute inset-0 bg-black/60 motion-safe:animate-fade-in" onClick={f.requestClose} />
        <div className="relative w-full sm:max-w-xl h-full bg-surface-solid backdrop-blur-xl border-l border-surface-border overflow-y-auto motion-safe:animate-slide-in-right">
          <div className="sticky top-0 z-10 bg-surface-solid backdrop-blur-xl border-b border-surface-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="signal-bar h-7" />
              <div>
                <h2 className="font-display text-lg font-medium leading-tight">
                  {trade ? "Edit trade" : duplicateFrom ? "Duplicate trade" : "New trade"}
                </h2>
                <p className="text-[11px] text-ink-muted leading-tight mt-0.5">
                  {trade
                    ? "Update the details of this trade"
                    : duplicateFrom
                      ? "Starts from the trade you copied"
                      : "Log a trade to your journal"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {trade && onOpenDiary && (
                <button
                  onClick={() => f.requestOpenDiary(trade)}
                  disabled={openingDiary}
                  title="Open this trade's diary entry — creates one if it doesn't exist yet"
                  className="flex items-center gap-1.5 text-xs font-medium text-glow bg-glow/15 border border-glow/40 hover:bg-glow/25 rounded-full px-3 py-1.5 disabled:opacity-60 transition-colors"
                >
                  <NotesIcon className="w-3.5 h-3.5" />
                  {openingDiary ? "Opening…" : "Diary"}
                </button>
              )}
              <button
                onClick={f.requestClose}
                className="w-8 h-8 flex items-center justify-center rounded-full text-ink-muted hover:text-ink-primary hover:bg-surface-2 transition-colors"
                aria-label="Close"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="w-4 h-4"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <TradeFormFields f={f} isEditing={!!trade} />
        </div>
      </div>
      <ConfirmDialog
        open={f.showDiscardConfirm}
        title={f.pendingAction === "diary" ? "Open diary entry?" : "Discard changes?"}
        description={
          f.pendingAction === "diary"
            ? "You have unsaved changes to this trade. Opening the diary entry now will discard them."
            : "You have unsaved changes to this trade. If you leave now, they'll be lost."
        }
        confirmLabel={f.pendingAction === "diary" ? "Discard & open diary" : "Discard changes"}
        cancelLabel="Keep editing"
        onCancel={() => f.setShowDiscardConfirm(false)}
        onConfirm={() => {
          f.setShowDiscardConfirm(false);
          if (f.pendingAction === "diary" && onOpenDiary && f.pendingDiaryTradeRef.current) {
            onOpenDiary(f.pendingDiaryTradeRef.current);
          } else {
            onClose();
          }
        }}
      />
    </>
  );
}
