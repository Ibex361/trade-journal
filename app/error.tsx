"use client";

import { useEffect } from "react";
import Button from "@/components/shared/Button";

/**
 * Root-level error boundary. Next.js renders this in place of `children`
 * whenever a rendering error escapes a page/layout below the root layout —
 * AppHeader and MobileTabBar (rendered by app/layout.tsx around {children})
 * stay mounted, so navigation is still available.
 *
 * Client-only by Next.js convention (error boundaries need componentDidCatch-
 * equivalent behavior at runtime).
 */
export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Matches the plain console.error convention used elsewhere in lib/
    // (no Sentry/logging service wired up in this project yet).
    console.error("Unhandled app error:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <section className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-8 max-w-md w-full text-center">
        <div className="flex justify-center mb-5">
          <div className="w-12 h-12 rounded-full bg-loss/10 border border-loss/30 flex items-center justify-center">
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-loss"
              aria-hidden="true"
            >
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
        </div>

        <h1 className="font-display text-lg font-medium text-ink-primary">
          Something went wrong
        </h1>
        <p className="text-ink-secondary text-sm mt-2">
          An unexpected error occurred while loading this page. Your trade data
          is untouched — you can try again or head back to the dashboard.
        </p>

        {process.env.NODE_ENV === "development" && (
          <pre className="mt-4 text-left text-xs text-loss/90 bg-loss/5 border border-loss/20 rounded-card p-3 overflow-x-auto whitespace-pre-wrap break-words">
            {error.message}
            {error.digest && `\n\nDigest: ${error.digest}`}
          </pre>
        )}

        <div className="flex items-center justify-center gap-3 mt-6">
          <Button variant="secondary" size="md" onClick={() => (window.location.href = "/")}>
            Go to dashboard
          </Button>
          <Button variant="primary" size="md" onClick={() => reset()}>
            Try again
          </Button>
        </div>
      </section>
    </div>
  );
}
