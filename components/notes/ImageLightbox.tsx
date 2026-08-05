"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Notes Phase 4 Part 3 — click-to-expand for images inside a note.
 * Rendered via a portal into document.body, same reasoning as
 * BubbleToolbar's rewrite: stays inside React's one render tree instead of
 * being managed by some other library, and escapes the note panel's
 * overflow-hidden so it can cover the full viewport.
 */
export default function ImageLightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 cursor-zoom-out"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-surface-1 border border-surface-border text-ink-secondary hover:text-ink-primary"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt ?? ""}
        onClick={(e) => e.stopPropagation()}
        className="max-w-full max-h-full rounded-lg shadow-glass cursor-default"
      />
    </div>,
    document.body
  );
}
