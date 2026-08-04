"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import type { JSONContent } from "@tiptap/react";

/**
 * Notes/diary — Phase 1a.
 *
 * The editor itself, isolated from any page, list, or persistence layer —
 * those are Phase 1b/1c. This is the riskiest, least-familiar piece of the
 * whole notes feature (nothing else in the app touches Tiptap or
 * contenteditable), so it gets built and proven out on its own first.
 *
 * Deliberately minimal: StarterKit's default set only (bold, italic,
 * strike, headings, lists, blockquote, code block, horizontal rule,
 * undo/redo). No links, tables, checklists, slash-menu, or image paste yet
 * — those are Phase 2+ per the approved 5-phase plan.
 */

type NoteEditorProps = {
  content?: JSONContent | null;
  onChange?: (content: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
};

function ToolbarButton({
  onClick,
  active,
  disabled,
  label,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center h-8 min-w-8 px-1.5 rounded-md text-sm font-medium transition-colors duration-fast
        disabled:opacity-30 disabled:pointer-events-none
        ${active ? "bg-glow/15 text-glow" : "text-ink-secondary hover:text-ink-primary hover:bg-surface-2"}`}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <span className="w-px h-5 bg-surface-border mx-1 shrink-0" />;
}

function Toolbar({ editor }: { editor: Editor }) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-surface-border">
      <ToolbarButton
        label="Bold"
        active={editor.isActive("bold")}
        onClick={() => editor.chain().focus().toggleBold().run()}
      >
        B
      </ToolbarButton>
      <ToolbarButton
        label="Italic"
        active={editor.isActive("italic")}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      >
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton
        label="Strikethrough"
        active={editor.isActive("strike")}
        onClick={() => editor.chain().focus().toggleStrike().run()}
      >
        <span className="line-through">S</span>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Heading 1"
        active={editor.isActive("heading", { level: 1 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
      >
        H1
      </ToolbarButton>
      <ToolbarButton
        label="Heading 2"
        active={editor.isActive("heading", { level: 2 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
      >
        H2
      </ToolbarButton>
      <ToolbarButton
        label="Heading 3"
        active={editor.isActive("heading", { level: 3 })}
        onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
      >
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Bullet list"
        active={editor.isActive("bulletList")}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Numbered list"
        active={editor.isActive("orderedList")}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 6h12M9 12h12M9 18h12" />
          <path d="M4 6h1v3M4 6l-1 .5M4.5 14.5c.5-1 2-1 2 0s-2 1.5-2.5 2.5h2.5M4 17.5h2" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Blockquote"
        active={editor.isActive("blockquote")}
        onClick={() => editor.chain().focus().toggleBlockquote().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M7 8c-2 1-3 2.5-3 5s1.5 3.5 3 3.5 2.5-1 2.5-2.5-1-2.5-2.3-2.5c.2-1.6 1.1-2.7 2.3-3.5z" />
          <path d="M16 8c-2 1-3 2.5-3 5s1.5 3.5 3 3.5 2.5-1 2.5-2.5-1-2.5-2.3-2.5c.2-1.6 1.1-2.7 2.3-3.5z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Code block"
        active={editor.isActive("codeBlock")}
        onClick={() => editor.chain().focus().toggleCodeBlock().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
        </svg>
      </ToolbarButton>

      <Divider />

      <ToolbarButton
        label="Undo"
        disabled={!editor.can().undo()}
        onClick={() => editor.chain().focus().undo().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-2" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Redo"
        disabled={!editor.can().redo()}
        onClick={() => editor.chain().focus().redo().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h2" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

const DEFAULT_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export default function NoteEditor({ content, onChange, editable = true, placeholder }: NoteEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing…",
      }),
    ],
    content: content ?? DEFAULT_DOC,
    editable,
    // Next.js renders this component server-side first; Tiptap's DOM-diffing
    // during that render doesn't match client hydration, so this has to be
    // off or React throws a hydration-mismatch error the first time this
    // component mounts.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-notes min-h-[240px] px-4 py-4 focus:outline-none text-ink-primary text-sm leading-relaxed",
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  if (!editor) {
    return (
      <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass overflow-hidden">
        <div className="min-h-[280px] animate-pulse bg-surface-2/40" />
      </div>
    );
  }

  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass overflow-hidden">
      {editable && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}
