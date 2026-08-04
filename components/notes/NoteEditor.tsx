"use client";

import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import type { JSONContent } from "@tiptap/react";

/**
 * Notes/diary — Phase 1a, extended in Phase 2 parts 1 and 2.
 *
 * The editor itself, isolated from any page, list, or persistence layer —
 * those are Phase 1b/1c. This is the riskiest, least-familiar piece of the
 * whole notes feature (nothing else in the app touches Tiptap or
 * contenteditable), so it gets built and proven out on its own first.
 *
 * Phase 1a shipped StarterKit's default set only. Phase 2 part 1 added
 * Link and Highlight. Phase 2 part 2 adds checklists (TaskList/TaskItem)
 * and tables — structural block content, vs. part 1's inline marks. Bubble
 * toolbar and slash-command menu are part 3.
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
      <ToolbarButton label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 11l6-6 4 4-6 6H9v-4z" />
          <path d="M5 21l3-3" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={handleSetLink}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 15l6-6" />
          <path d="M11 6l1-1a3.5 3.5 0 015 5l-1 1" />
          <path d="M13 18l-1 1a3.5 3.5 0 01-5-5l1-1" />
        </svg>
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
        label="Checklist"
        active={editor.isActive("taskList")}
        onClick={() => editor.chain().focus().toggleTaskList().run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3.5" y="4" width="6" height="6" rx="1.5" />
          <path d="M5 7l1 1 2-2" />
          <path d="M12 7h9" />
          <rect x="3.5" y="14" width="6" height="6" rx="1.5" />
          <path d="M12 17h9" />
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

      {editor.isActive("table") ? (
        <>
          <ToolbarButton label="Add column" onClick={() => editor.chain().focus().addColumnAfter().run()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="4" width="18" height="16" rx="1.5" />
              <path d="M12 4v16" />
              <path d="M17 9v6M14 12h6" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Add row" onClick={() => editor.chain().focus().addRowAfter().run()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="4" width="18" height="16" rx="1.5" />
              <path d="M3 12h18" />
              <path d="M9 17v6M6 20h6" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            label="Delete column"
            onClick={() => editor.chain().focus().deleteColumn().run()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="4" width="18" height="16" rx="1.5" />
              <path d="M9 4v16M15 4v16" />
              <path d="M10 9l4 4M14 9l-4 4" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            label="Delete row"
            onClick={() => editor.chain().focus().deleteRow().run()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="4" width="18" height="16" rx="1.5" />
              <path d="M3 9h18M3 15h18" />
              <path d="M9 10l4 4M14 10l-4 4" />
            </svg>
          </ToolbarButton>
          <ToolbarButton
            label="Delete table"
            onClick={() => editor.chain().focus().deleteTable().run()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
              <rect x="3" y="4" width="18" height="16" rx="1.5" />
              <path d="M8 9l8 8M16 9l-8 8" />
            </svg>
          </ToolbarButton>
        </>
      ) : (
        <ToolbarButton
          label="Insert table"
          onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <path d="M3 10h18M9 4v16" />
          </svg>
        </ToolbarButton>
      )}

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
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
      }),
      Highlight,
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
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
