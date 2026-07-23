"use client";

import type { ReactNode } from "react";

/**
 * Prepared for Step 4 — there's no existing shared modal/toast component to
 * rebuild (TradeFormPanel's slide-over, the Trades delete confirmation, and
 * TradeSpotlight's screenshot lightbox each currently hand-roll their own
 * "fixed inset-0" overlay). Wire this in when Step 4 reaches those pages.
 */
export default function Modal({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-surface-0/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-md bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-6">
        {children}
      </div>
    </div>
  );
}
