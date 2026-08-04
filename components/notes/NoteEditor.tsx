"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  useEditor,
  EditorContent,
  BubbleMenu,
  type Editor,
  type JSONContent,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import Highlight from "@tiptap/extension-highlight";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Table from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableHeader from "@tiptap/extension-table-header";
import TableCell from "@tiptap/extension-table-cell";
import Button from "@/components/shared/Button";

/**
 * Notes/diary — Phase 2 rich editor (+ polish).
 *
 * Links use an in-app dialog (never window.prompt). While editing, links are
 * not hijacked by the browser — use the bubble "Open" control. Mobile
 * backspace at the start of an empty doc is swallowed so Android doesn't
 * treat it as browser Back.
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

function LinkDialog({
  open,
  initialUrl,
  onApply,
  onRemove,
  onClose,
}: {
  open: boolean;
  initialUrl: string;
  onApply: (url: string) => void;
  onRemove: () => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUrl(initialUrl || "https://");
      // Focus after paint so the keyboard opens cleanly on mobile
      const t = window.setTimeout(() => inputRef.current?.focus(), 50);
      return () => window.clearTimeout(t);
    }
  }, [open, initialUrl]);

  if (!open) return null;

  function submit() {
    const trimmed = url.trim();
    if (!trimmed || trimmed === "https://" || trimmed === "http://") {
      onRemove();
      return;
    }
    onApply(trimmed);
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 motion-safe:animate-fade-in" onClick={onClose} />
      <div
        className="relative w-full max-w-sm bg-surface-solid backdrop-blur-xl border border-surface-border rounded-panel shadow-glass p-6 motion-safe:animate-scale-in"
        role="dialog"
        aria-labelledby="link-dialog-title"
      >
        <h3 id="link-dialog-title" className="font-display text-base font-medium text-ink-primary">
          {initialUrl ? "Edit link" : "Add link"}
        </h3>
        <p className="text-sm text-ink-secondary mt-1.5">
          Paste a full URL. Leave empty and remove to clear the link.
        </p>
        <input
          ref={inputRef}
          type="url"
          inputMode="url"
          autoComplete="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
            }
          }}
          placeholder="https://"
          className="mt-4 w-full rounded-lg bg-surface-2 border border-surface-border px-3 py-2.5 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-glow/50"
        />
        <div className="flex items-center justify-between gap-2 mt-5 flex-wrap">
          <div>
            {initialUrl ? (
              <Button variant="ghost" size="sm" onClick={onRemove}>
                Remove link
              </Button>
            ) : (
              <span />
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={submit}>
              Apply
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Toolbar({
  editor,
  onRequestLink,
}: {
  editor: Editor;
  onRequestLink: () => void;
}) {
  return (
    <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 border-b border-surface-border">
      <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
        B
      </ToolbarButton>
      <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolbarButton>
      <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <span className="underline">U</span>
      </ToolbarButton>
      <ToolbarButton label="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolbarButton>
      <ToolbarButton label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 11l-6 6v3h3l6-6" />
          <path d="M13 7l4 4 4.5-4.5a2.12 2.12 0 00-3-3L13 7z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Link" active={editor.isActive("link")} onClick={onRequestLink}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
        </svg>
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Heading 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        H1
      </ToolbarButton>
      <ToolbarButton label="Heading 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        H2
      </ToolbarButton>
      <ToolbarButton label="Heading 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}>
        H3
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Bullet list" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-4 h-4">
          <path d="M8 6h13M8 12h13M8 18h13" />
          <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Numbered list" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 6h12M9 12h12M9 18h12" />
          <path d="M4 6h1v3M4 6l-1 .5M4.5 14.5c.5-1 2-1 2 0s-2 1.5-2.5 2.5h2.5M4 17.5h2" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Checklist" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 11l3 3L22 4" />
          <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M7 8c-2 1-3 2.5-3 5s1.5 3.5 3 3.5 2.5-1 2.5-2.5-1-2.5-2.3-2.5c.2-1.6 1.1-2.7 2.3-3.5z" />
          <path d="M16 8c-2 1-3 2.5-3 5s1.5 3.5 3 3.5 2.5-1 2.5-2.5-1-2.5-2.3-2.5c.2-1.6 1.1-2.7 2.3-3.5z" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Code block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
        </svg>
      </ToolbarButton>
      <ToolbarButton
        label="Table"
        active={editor.isActive("table")}
        onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
        </svg>
      </ToolbarButton>

      <Divider />

      <ToolbarButton label="Undo" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 14L4 9l5-5M4 9h10a6 6 0 010 12h-2" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Redo" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M15 14l5-5-5-5M20 9H10a6 6 0 000 12h2" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

type SlashItem = {
  title: string;
  description: string;
  keywords: string;
  run: (editor: Editor) => void;
};

const SLASH_ITEMS: SlashItem[] = [
  { title: "Heading 1", description: "Large section heading", keywords: "h1 title", run: (e) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { title: "Heading 2", description: "Medium section heading", keywords: "h2 subtitle", run: (e) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { title: "Heading 3", description: "Small section heading", keywords: "h3", run: (e) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { title: "Bullet list", description: "Unordered list", keywords: "ul bullets", run: (e) => e.chain().focus().toggleBulletList().run() },
  { title: "Numbered list", description: "Ordered list", keywords: "ol numbers", run: (e) => e.chain().focus().toggleOrderedList().run() },
  { title: "Checklist", description: "Tasks with checkboxes", keywords: "todo task checkbox", run: (e) => e.chain().focus().toggleTaskList().run() },
  { title: "Quote", description: "Blockquote", keywords: "blockquote cite", run: (e) => e.chain().focus().toggleBlockquote().run() },
  { title: "Code block", description: "Monospace code", keywords: "code pre", run: (e) => e.chain().focus().toggleCodeBlock().run() },
  { title: "Table", description: "3×3 table with header", keywords: "grid spreadsheet", run: (e) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { title: "Divider", description: "Horizontal rule", keywords: "hr line", run: (e) => e.chain().focus().setHorizontalRule().run() },
];

function SlashMenu({
  editor,
  open,
  query,
  position,
  selectedIndex,
  onClose,
  onSelectIndex,
}: {
  editor: Editor;
  open: boolean;
  query: string;
  position: { top: number; left: number } | null;
  selectedIndex: number;
  onClose: () => void;
  onSelectIndex: (i: number) => void;
}) {
  const filtered = SLASH_ITEMS.filter((item) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      item.title.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      item.keywords.toLowerCase().includes(q)
    );
  });

  const runItem = useCallback(
    (item: SlashItem) => {
      const { from } = editor.state.selection;
      const deleteFrom = Math.max(0, from - (query.length + 1));
      editor.chain().focus().deleteRange({ from: deleteFrom, to: from }).run();
      item.run(editor);
      onClose();
    },
    [editor, onClose, query]
  );

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        onSelectIndex(selectedIndex + 1);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        onSelectIndex(selectedIndex - 1);
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const item = filtered[selectedIndex % Math.max(filtered.length, 1)];
        if (item) runItem(item);
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, selectedIndex, filtered, onClose, onSelectIndex, runItem]);

  if (!open || !position || filtered.length === 0) return null;

  const active = ((selectedIndex % filtered.length) + filtered.length) % filtered.length;

  return (
    <div
      className="fixed z-50 w-64 max-h-72 overflow-y-auto rounded-panel border border-surface-border bg-surface-solid/95 backdrop-blur-xl shadow-glass py-1 motion-safe:animate-fade-in"
      style={{ top: position.top, left: position.left }}
      role="listbox"
    >
      {filtered.map((item, i) => (
        <button
          key={item.title}
          type="button"
          role="option"
          aria-selected={i === active}
          className={`w-full text-left px-3 py-2 transition-colors duration-fast ${
            i === active ? "bg-glow/15 text-ink-primary" : "text-ink-secondary hover:bg-surface-2 hover:text-ink-primary"
          }`}
          onMouseDown={(e) => {
            e.preventDefault();
            runItem(item);
          }}
          onMouseEnter={() => onSelectIndex(i)}
        >
          <div className="text-sm font-medium">{item.title}</div>
          <div className="text-[11px] text-ink-muted">{item.description}</div>
        </button>
      ))}
    </div>
  );
}

const DEFAULT_DOC: JSONContent = { type: "doc", content: [{ type: "paragraph" }] };

export default function NoteEditor({ content, onChange, editable = true, placeholder }: NoteEditorProps) {
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashPos, setSlashPos] = useState<{ top: number; left: number } | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkInitial, setLinkInitial] = useState("");

  const openLinkDialog = useCallback((editor: Editor) => {
    const prev = (editor.getAttributes("link").href as string | undefined) ?? "";
    setLinkInitial(prev);
    setLinkOpen(true);
  }, []);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Placeholder.configure({
        placeholder: placeholder ?? "Start writing… Type / for commands",
      }),
      Underline,
      Link.configure({
        // While editing, don't navigate on tap (that makes links uneditable on mobile).
        // Use the bubble "Open" control instead. openOnClick is for read-only views.
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
        HTMLAttributes: {
          class: "note-link",
          rel: "noopener noreferrer",
          target: "_blank",
        },
      }),
      Highlight.configure({ multicolor: false }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: false }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    content: content ?? DEFAULT_DOC,
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class:
          "prose-notes min-h-[240px] px-4 py-4 focus:outline-none text-ink-primary text-sm leading-relaxed",
      },
      handleKeyDown: (view, event) => {
        if (slashOpen && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
          return true;
        }
        // Mobile / desktop: when the doc is empty and caret is at the start,
        // Backspace must not bubble into browser history (Android does this).
        if (event.key === "Backspace") {
          const { empty, from } = view.state.selection;
          if (empty && from <= 1 && view.state.doc.textContent.length === 0) {
            event.preventDefault();
            return true;
          }
        }
        return false;
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange?.(ed.getJSON());

      const { from } = ed.state.selection;
      const textBefore = ed.state.doc.textBetween(Math.max(0, from - 32), from, "\n", "\0");
      const match = textBefore.match(/(?:^|\s)\/([a-zA-Z0-9]*)$/);
      if (match) {
        const query = match[1] ?? "";
        setSlashQuery(query);
        setSlashOpen(true);
        setSlashIndex(0);
        try {
          const coords = ed.view.coordsAtPos(from);
          setSlashPos({ top: coords.bottom + 6, left: coords.left });
        } catch {
          setSlashPos({ top: 120, left: 24 });
        }
      } else if (slashOpen) {
        setSlashOpen(false);
        setSlashQuery("");
      }
    },
  });

  useEffect(() => {
    if (!editor) return;
    const next = content ?? DEFAULT_DOC;
    const current = editor.getJSON();
    if (JSON.stringify(current) !== JSON.stringify(next)) {
      editor.commands.setContent(next, false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor, content]);

  useEffect(() => {
    if (editor) editor.setEditable(editable);
  }, [editor, editable]);

  if (!editor) {
    return (
      <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass overflow-hidden">
        <div className="min-h-[280px] animate-pulse bg-surface-2/40" />
      </div>
    );
  }

  const activeHref = (editor.getAttributes("link").href as string | undefined) ?? "";

  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass overflow-hidden relative">
      {editable && <Toolbar editor={editor} onRequestLink={() => openLinkDialog(editor)} />}

      {editable && (
        <BubbleMenu
          editor={editor}
          tippyOptions={{ duration: 120, placement: "top" }}
          className="flex items-center gap-0.5 px-1 py-1 rounded-full border border-surface-border bg-surface-solid/95 backdrop-blur-xl shadow-glass"
        >
          <ToolbarButton label="Bold" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
            B
          </ToolbarButton>
          <ToolbarButton label="Italic" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
            <span className="italic">I</span>
          </ToolbarButton>
          <ToolbarButton label="Underline" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
            <span className="underline">U</span>
          </ToolbarButton>
          <ToolbarButton label="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M9 11l-6 6v3h3l6-6M13 7l4 4 4.5-4.5a2.12 2.12 0 00-3-3L13 7z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton label="Link" active={editor.isActive("link")} onClick={() => openLinkDialog(editor)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
              <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
              <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
            </svg>
          </ToolbarButton>
          {activeHref && (
            <ToolbarButton
              label="Open link"
              onClick={() => {
                window.open(activeHref, "_blank", "noopener,noreferrer");
              }}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
                <path d="M15 3h6v6" />
                <path d="M10 14L21 3" />
              </svg>
            </ToolbarButton>
          )}
        </BubbleMenu>
      )}

      <EditorContent editor={editor} />

      <SlashMenu
        editor={editor}
        open={slashOpen && editable}
        query={slashQuery}
        position={slashPos}
        selectedIndex={slashIndex}
        onClose={() => {
          setSlashOpen(false);
          setSlashQuery("");
        }}
        onSelectIndex={(i) => setSlashIndex(i)}
      />

      <LinkDialog
        open={linkOpen}
        initialUrl={linkInitial}
        onClose={() => setLinkOpen(false)}
        onRemove={() => {
          editor.chain().focus().extendMarkRange("link").unsetLink().run();
          setLinkOpen(false);
        }}
        onApply={(url) => {
          editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
          setLinkOpen(false);
        }}
      />
    </div>
  );
}
