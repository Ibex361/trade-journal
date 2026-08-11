import type { Editor, Range } from "@tiptap/react";

/**
 * Notes/diary — Phase 2 part 3.
 *
 * The block-type menu offered by the slash-command popup. Kept separate
 * from the popup component itself (SlashCommandList) and the Tiptap wiring
 * (slashCommand.ts) so the list of options is easy to scan and extend.
 */

export type SlashCommandItem = {
  title: string;
  description: string;
  icon: React.ReactNode;
  command: (props: { editor: Editor; range: Range }) => void;
};

const iconClass = "w-4 h-4";

export const SLASH_COMMAND_ITEMS: SlashCommandItem[] = [
  {
    title: "Heading 1",
    description: "Big section heading",
    icon: <span className="text-[11px] font-semibold">H1</span>,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    description: "Medium section heading",
    icon: <span className="text-[11px] font-semibold">H2</span>,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    description: "Small section heading",
    icon: <span className="text-[11px] font-semibold">H3</span>,
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    description: "Simple unordered list",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={iconClass}>
        <path d="M8 6h13M8 12h13M8 18h13" />
        <circle cx="3.5" cy="6" r="1" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="12" r="1" fill="currentColor" stroke="none" />
        <circle cx="3.5" cy="18" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "List with numbering",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <path d="M9 6h12M9 12h12M9 18h12" />
        <path d="M4 6h1v3M4 6l-1 .5M4.5 14.5c.5-1 2-1 2 0s-2 1.5-2.5 2.5h2.5M4 17.5h2" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Checklist",
    description: "Track to-dos with checkboxes",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <rect x="3.5" y="4" width="6" height="6" rx="1.5" />
        <path d="M5 7l1 1 2-2" />
        <path d="M12 7h9" />
        <rect x="3.5" y="14" width="6" height="6" rx="1.5" />
        <path d="M12 17h9" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Table",
    description: "Insert a 3×3 table",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <rect x="3" y="4" width="18" height="16" rx="1.5" />
        <path d="M3 10h18M9 4v16" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
  },
  {
    title: "Blockquote",
    description: "Quoted passage",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <path d="M7 8c-2 1-3 2.5-3 5s1.5 3.5 3 3.5 2.5-1 2.5-2.5-1-2.5-2.3-2.5c.2-1.6 1.1-2.7 2.3-3.5z" />
        <path d="M16 8c-2 1-3 2.5-3 5s1.5 3.5 3 3.5 2.5-1 2.5-2.5-1-2.5-2.3-2.5c.2-1.6 1.1-2.7 2.3-3.5z" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    description: "Monospaced code snippet",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={iconClass}>
        <path d="M9 18l-6-6 6-6M15 6l6 6-6 6" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    description: "Horizontal rule",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className={iconClass}>
        <path d="M4 12h16" />
      </svg>
    ),
    command: ({ editor, range }) =>
      editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];
