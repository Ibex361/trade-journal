"use client";

import { BubbleMenu, type Editor } from "@tiptap/react";

/**
 * Notes/diary — Phase 2 part 3.
 *
 * A compact floating toolbar that appears above a text selection, so
 * formatting doesn't require reaching up to the fixed toolbar. Covers the
 * inline marks only (bold/italic/strike/highlight/link) — block-type
 * changes stay on the main toolbar and the new slash-command menu.
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

export default function BubbleToolbar({ editor }: { editor: Editor }) {
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

  return (
    <BubbleMenu
      editor={editor}
      tippyOptions={{ duration: 120, placement: "top" }}
      shouldShow={({ editor, state }) => {
        const { selection } = state;
        const { empty, from, to } = selection;
        const isEmptyTextSelection = state.doc.textBetween(from, to).length === 0;
        if (empty || isEmptyTextSelection || !editor.isEditable) return false;
        // Formatting marks don't apply inside code blocks — nothing useful to show.
        if (editor.isActive("codeBlock")) return false;
        return true;
      }}
    >
      <div className="flex items-center gap-0.5 px-1.5 py-1 bg-surface-solid backdrop-blur-md border border-surface-border rounded-lg shadow-glass">
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
      </div>
    </BubbleMenu>
  );
}
