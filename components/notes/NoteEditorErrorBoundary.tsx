"use client";

import { Component, type ReactNode } from "react";

/**
 * Notes Phase 4 Part 1 follow-up fix.
 *
 * Tiptap/ProseMirror is the riskiest, least-battle-tested piece of the app
 * (nothing else touches contenteditable), and a thrown error during its
 * rendering — e.g. an editor command that doesn't fit the current document
 * schema — was propagating all the way up and crashing the entire app to
 * Next.js's generic "Application error" page. Error boundaries can only be
 * class components (no hook equivalent), so this is kept minimal and
 * scoped to just wrapping the editor.
 */
type Props = { children: ReactNode };
type State = { hasError: boolean; details: string | null };

export default class NoteEditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, details: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    // Error/DOMException objects often log as "{}" in some devtools/remote
    // console viewers (their useful fields — name, message, stack — aren't
    // plain enumerable own properties, so a naive object-print shows
    // nothing). Pulling them out as plain strings here makes them show up
    // in any console viewer, and — since this app's user relies on a
    // mobile remote-console tool that has shown this exact "{}" problem —
    // it's also shown directly in the fallback UI below, so a screenshot
    // of the note panel itself is enough, no devtools digging required.
    const err = error as { name?: string; message?: string; stack?: string } | null | undefined;
    const details = err
      ? `${err.name ?? "Error"}: ${err.message ?? "(no message)"}`
      : String(error);
    console.error("Note editor crashed —", details);
    if (err?.stack) console.error(err.stack);
    this.setState({ details });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-4 text-sm text-ink-secondary space-y-2">
          <p>Something went wrong displaying this note&apos;s editor. Your other notes and data are unaffected — try closing and reopening this note.</p>
          {this.state.details && (
            <p className="text-[11px] text-ink-muted font-mono break-words">{this.state.details}</p>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}
