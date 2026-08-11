"use client";

import Button from "@/components/shared/Button";

/**
 * A styled stand-in for window.confirm() — same job (ask before doing
 * something risky), but rendered in the app's own glass/blur language
 * instead of the browser's native, unstyleable popup.
 */
export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive = true,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 motion-safe:animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-surface-solid backdrop-blur-xl border border-surface-border rounded-panel shadow-glass p-6 motion-safe:animate-scale-in">
        <h3 className="font-display text-base font-medium text-ink-primary">{title}</h3>
        {description && <p className="text-sm text-ink-secondary mt-2 leading-relaxed">{description}</p>}
        <div className="flex items-center justify-end gap-3 mt-6">
          <Button variant="ghost" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={destructive ? "danger" : "primary"} size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
