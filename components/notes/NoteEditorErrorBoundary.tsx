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
type State = { hasError: boolean };

export default class NoteEditorErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error("Note editor crashed:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass p-4 text-sm text-ink-secondary">
          Something went wrong displaying this note's editor. Your other notes and data are unaffected — try closing and reopening this note.
        </div>
      );
    }
    return this.props.children;
  }
}
