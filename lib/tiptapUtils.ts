import type { Editor } from "@tiptap/react";
import { NodeSelection } from "@tiptap/pm/state";

/**
 * Small shared helpers, ported from Tiptap's own UI Components library
 * (lib/tiptap-utils.ts, MIT licensed: github.com/ueberdosis/
 * tiptap-ui-components) — only the four functions this app's ports
 * (Color highlight popover, and anything built the same way later)
 * actually use. Their real file is much larger (image upload helpers,
 * URL sanitization, node-finding utilities for components this app
 * doesn't have) — not ported here since nothing calls them.
 */

/** Joins class names, dropping falsy values. Same behavior as their `cn`. */
export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

const MAC_SYMBOLS: Record<string, string> = {
  mod: "⌘",
  command: "⌘",
  meta: "⌘",
  ctrl: "⌃",
  control: "⌃",
  alt: "⌥",
  option: "⌥",
  shift: "⇧",
};

function isMac(): boolean {
  return typeof navigator !== "undefined" && navigator.platform.toLowerCase().includes("mac");
}

function formatShortcutKey(key: string, mac: boolean, capitalize = true): string {
  if (mac) {
    const lower = key.toLowerCase();
    return MAC_SYMBOLS[lower] || (capitalize ? key.toUpperCase() : key);
  }
  return capitalize ? key.charAt(0).toUpperCase() + key.slice(1) : key;
}

/** Parses e.g. "mod+shift+h" into platform-appropriate display symbols. */
export function parseShortcutKeys(props: { shortcutKeys: string | undefined; delimiter?: string; capitalize?: boolean }) {
  const { shortcutKeys, delimiter = "+", capitalize = true } = props;
  if (!shortcutKeys) return [];
  return shortcutKeys
    .split(delimiter)
    .map((key) => key.trim())
    .map((key) => formatShortcutKey(key, isMac(), capitalize));
}

/** Checks whether a mark (e.g. "highlight") is registered in the editor's schema. */
export function isMarkInSchema(markName: string, editor: Editor | null): boolean {
  if (!editor?.schema) return false;
  return editor.schema.spec.marks.get(markName) !== undefined;
}

/** True if the current selection is a NodeSelection of one of the given node types. */
export function isNodeTypeSelected(editor: Editor | null, types: string[] = []): boolean {
  if (!editor || !editor.state.selection) return false;
  const { selection } = editor.state;
  if (selection.empty) return false;
  if (selection instanceof NodeSelection) {
    return types.includes(selection.node.type.name);
  }
  return false;
}
