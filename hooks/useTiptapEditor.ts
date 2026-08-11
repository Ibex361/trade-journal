"use client";

import type { Editor } from "@tiptap/react";

/**
 * Adapted from Tiptap's own UI Components library (hooks/use-tiptap-editor.ts,
 * MIT licensed: github.com/ueberdosis/tiptap-ui-components).
 *
 * Real difference from their source: their version falls back to
 * `useCurrentEditor()` from `@tiptap/react`'s `<EditorContext.Provider>`
 * when no editor is passed directly, so their UI components work either
 * wrapped in that provider or given an editor prop. This app's
 * NoteEditor.tsx never sets up that context — every component here (the
 * fixed Toolbar, popovers, etc.) already receives `editor` as a required
 * prop directly. So this version just returns the provided editor with
 * no context fallback — same shape (`{ editor }`) the ported components
 * expect, simpler because this app doesn't need the other half of what
 * the real hook does.
 */
export function useTiptapEditor(providedEditor?: Editor | null): { editor: Editor | null } {
  return { editor: providedEditor ?? null };
}
