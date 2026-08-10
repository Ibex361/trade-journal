"use client";

import { useTradeForm } from "@/hooks/useTradeForm";
import { Trade } from "@/lib/trades";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { NotesIcon } from "@/components/icons";
import TradeFormFields from "./trade-form/TradeFormFields";

/**
 * Slide-over shell for creating, editing, or duplicating a trade.
 * The visual hierarchy lives in TradeFormFields; this component owns only the
 * surface, header, and discard confirmation.
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
  onOpenDiary?: (trade: Trade) => void;
  openingDiary?: boolean;
}) {
  const f = useTradeForm({ trade, duplicateFrom, onClose, onSaved, onOpenDiary });
  const title = trade ? "Edit trade" : duplicateFrom ? "Duplicate trade" : "New trade";
  const subtitle = trade
    ? "Review the setup, execution and outcome."
    : duplicateFrom
      ? "Start from an existing trade and adjust what changed."
      : "Capture the trade while the details are fresh.";

  return (
    <>
      <div className="fixed inset-0 z-40 flex justify-end">
        <div
          className="absolute inset-0 bg-black/70 backdrop-blur-[2px] motion-safe:animate-fade-in"
          onClick={f.requestClose}
        />

        <div className="relative flex h-full w-full flex-col overflow-hidden border-l border-white/[0.08] bg-surface-solid shadow-2xl motion-safe:animate-slide-in-right sm:max-w-xl lg:max-w-2xl">
          <header className="relative z-10 shrink-0 border-b border-white/[0.08] bg-surface-solid/95 px-5 py-4 backdrop-blur-xl sm:px-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-1.5 flex items-center gap-2.5">
                  <span className="signal-bar h-7" />
                  <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-glow">
                    Trade journal
                  </span>
                </div>
                <div className="flex items-baseline gap-3">
                  <h2 className="font-display text-xl font-semibold tracking-tight text-ink-primary">
                    {title}
                  </h2>
                  <span className="hidden text-[11px] text-ink-muted sm:inline">Required fields marked *</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed text-ink-secondary">{subtitle}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                {trade && onOpenDiary && (
                  <button
                    type="button"
                    onClick={() => f.requestOpenDiary(trade)}
                    disabled={openingDiary}
                    title="Open this trade's diary entry — creates one if it doesn't exist yet"
                    className="inline-flex items-center gap-1.5 rounded-full border border-glow/30 bg-glow/10 px-3 py-1.5 text-xs font-medium text-glow transition-colors hover:border-glow/50 hover:bg-glow/15 disabled:opacity-60"
                  >
                    <NotesIcon className="h-3.5 w-3.5" />
                    {openingDiary ? "Opening…" : "Diary"}
                  </button>
                )}
                <button
                  type="button"
                  onClick={f.requestClose}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent text-ink-muted transition-colors hover:border-surface-border hover:bg-surface-2 hover:text-ink-primary"
                  aria-label="Close"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-5 w-5">
                    <path d="M6 6l12 12M18 6L6 18" />
                  </svg>
                </button>
              </div>
            </div>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <TradeFormFields f={f} isEditing={!!trade} />
          </div>
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
