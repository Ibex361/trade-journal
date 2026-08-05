"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";

/**
 * Notes/diary — Phase 2 part 3, rewritten in Notes Phase 4 as a crash fix.
 *
 * A compact floating toolbar that appears above a text selection, so
 * formatting doesn't require reaching up to the fixed toolbar. Covers the
 * inline marks only (bold/italic/strike/highlight/link) — block-type
 * changes stay on the main toolbar and the slash-command menu.
 *
 * Originally built on @tiptap/react's `BubbleMenu`, which renders its
 * popup via tippy.js into a DOM node tippy manages itself — effectively a
 * second, detached React render root outside this app's normal tree. That
 * combination is a documented source of "NotFoundError: Failed to execute
 * 'insertBefore'" crashes in Tiptap v2 + React 18, confirmed here by two
 * rounds of user-provided crash screenshots (both this exact error, both
 * triggered by inserting an image while this toolbar was mounted) that
 * persisted even after disabling tippy's show/hide animation and deferring
 * the image insert — neither of which touches the actual dual-render-root
 * problem. Tiptap's own v3 removed tippy.js from these menus for the same
 * reason, but upgrading this whole app to v3 is a much larger, breaking
 * change that can't be safely done without a working build to test it.
 *
 * This version drops tippy.js/`BubbleMenu` entirely: visibility and
 * position are tracked with plain editor events + useState, and the menu
 * itself is rendered through a React portal straight into `document.body`.
 * A portal keeps this DOM node inside React's one render tree/commit
 * (unlike tippy's separate render call) — that's what actually removes the
 * crash — while still escaping this note panel's `overflow-hidden` so the
 * toolbar isn't clipped near the panel's edges.
 */

function BubbleButton({
  onClick,
  active,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      // Selection would otherwise collapse on mousedown before onClick fires.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center h-7 min-w-7 px-1.5 rounded-md text-sm font-medium transition-colors duration-fast
        ${active ? "bg-glow/15 text-glow" : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

type Position = { top: number; left: number } | null;

function computePosition(editor: Editor): Position {
  const { state, view } = editor;
  const { from, to, empty } = state.selection;
  if (empty || state.doc.textBetween(from, to).length === 0) return null;
  if (!editor.isEditable || editor.isActive("codeBlock")) return null;
  if (!view.hasFocus()) return null;
  try {
    const start = view.coordsAtPos(from);
    const end = view.coordsAtPos(to);
    // coordsAtPos returns viewport-relative coordinates (same space as
    // getBoundingClientRect), which is exactly what position: fixed needs.
    return {
      top: Math.min(start.top, end.top),
      left: (Math.min(start.left, end.left) + Math.max(start.right, end.right)) / 2,
    };
  } catch {
    // coordsAtPos can throw if the position doesn't resolve to a DOM
    // rect yet (e.g. mid-transaction) — just skip showing this time.
    return null;
  }
}

export default function BubbleToolbar({ editor }: { editor: Editor }) {
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<Position>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    function update() {
      setPosition(computePosition(editor));
    }
    function hide() {
      setPosition(null);
    }
    editor.on("transaction", update);
    editor.on("selectionUpdate", update);
    editor.on("focus", update);
    editor.on("blur", hide);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    update();
    return () => {
      editor.off("transaction", update);
      editor.off("selectionUpdate", update);
      editor.off("focus", update);
      editor.off("blur", hide);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [editor]);

  function handleSetLink() {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", previousUrl ?? "https://");
    if (url === null) return; // cancelled
    if (url.trim() === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  }

  if (!mounted || !position) return null;

  return createPortal(
    <div
      // translateX centers on the selection midpoint; translateY lifts the
      // menu above the selection with a small gap, mirroring the old
      // tippy "top" placement.
      style={{
        position: "fixed",
        top: position.top,
        left: position.left,
        transform: "translate(-50%, calc(-100% - 8px))",
        zIndex: 60,
      }}
      className="flex items-center gap-0.5 px-1.5 py-1 bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass"
    >
      <BubbleButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </BubbleButton>
      <BubbleButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </BubbleButton>
      <BubbleButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </BubbleButton>
      <BubbleButton label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M9 11l6-6 4 4-6 6H9v-4z" />
          <path d="M5 21l3-3" />
        </svg>
      </BubbleButton>
      <BubbleButton label="Link" active={editor.isActive("link")} onClick={handleSetLink}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5">
          <path d="M9 15l6-6" />
          <path d="M11 6l1-1a3.5 3.5 0 015 5l-1 1" />
          <path d="M13 18l-1 1a3.5 3.5 0 01-5-5l1-1" />
        </svg>
      </BubbleButton>
    </div>,
    document.body
  );
}
