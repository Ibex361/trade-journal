"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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
import BubbleToolbar from "./BubbleToolbar";
import SlashCommand from "./slashCommand";
import NoteImage from "./NoteImage";
import ImageLightbox from "./ImageLightbox";
import { uploadNoteImage } from "@/lib/noteImages";
import { validateScreenshotFile } from "@/lib/screenshots";

/**
 * Notes/diary — Phase 1a, extended through Phase 2 and Phase 4 Part 1.
 *
 * The editor itself, isolated from any page, list, or persistence layer —
 * those are Phase 1b/1c. This is the riskiest, least-familiar piece of the
 * whole notes feature (nothing else in the app touches Tiptap or
 * contenteditable), so it gets built and proven out on its own first.
 *
 * Phase 1a shipped StarterKit's default set only. Phase 2 part 1 added
 * Link and Highlight. Phase 2 part 2 added checklists (TaskList/TaskItem)
 * and tables. Phase 2 part 3 added a floating BubbleToolbar for text
 * selections and a "/" slash-command menu for inserting block types.
 * Phase 4 Part 1 (this) adds image support: paste-from-clipboard,
 * drag-and-drop, and a manual toolbar button, all uploading to ImageKit
 * via lib/noteImages.ts and inserting a NoteImage node. Embedding an
 * *existing* trade screenshot (browsing rather than uploading) is Phase 4
 * Part 2; deleting orphaned images is Phase 4 Part 3 — this part only
 * covers getting new images into the doc.
 */

type NoteEditorProps = {
  content?: JSONContent | null;
  onChange?: (content: JSONContent) => void;
  editable?: boolean;
  placeholder?: string;
  // Needed to namespace uploaded images in ImageKit (see lib/noteImages.ts).
  // Image upload is disabled (paste/drop ignored, toolbar button hidden)
  // when this is null, e.g. before an account has loaded.
  accountId?: string | null;
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

function Toolbar({
  editor,
  onInsertImageClick,
  imagesEnabled,
}: {
  editor: Editor;
  onInsertImageClick?: () => void;
  imagesEnabled?: boolean;
}) {
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
      {imagesEnabled && (
        <ToolbarButton label="Insert image" onClick={() => onInsertImageClick?.()}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <rect x="3" y="4" width="18" height="16" rx="1.5" />
            <circle cx="8.5" cy="9.5" r="1.5" />
            <path d="M3 16l5-5 4 4 3-3 6 6" />
          </svg>
        </ToolbarButton>
      )}

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

export default function NoteEditor({ content, onChange, editable = true, placeholder, accountId }: NoteEditorProps) {
  // Number of images currently uploading (supports pasting/dropping more
  // than one at once) and the most recent upload error, if any. Kept
  // outside the editor doc itself — an in-progress upload has no node in
  // the doc yet, it's inserted only once the URL comes back.
  const [uploadingCount, setUploadingCount] = useState(0);
  const [imageError, setImageError] = useState<string | null>(null);
  // Phase 4 Part 3: click-to-expand. Holds the clicked image's src/alt, or
  // null when no lightbox is open.
  const [lightbox, setLightbox] = useState<{ src: string; alt?: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Samsung Internet (and some other mobile browsers) has a known bug where
  // the React synthetic onChange event does NOT fire on a hidden file input
  // that was triggered programmatically via .click() when the user navigates
  // through the file manager path (vs the browser's native media picker sheet).
  // The files are selected — the upload even reaches ImageKit — but React never
  // sees the event. Fix: attach a real native DOM "change" listener, which fires
  // reliably from both paths. We keep handleFileInputChange as the handler body
  // so the logic stays in one place.
  useEffect(() => {
    const input = fileInputRef.current;
    if (!input) return;
    function handleNativeChange() {
      const files = Array.from(input!.files ?? []);
      files.forEach((file) => insertImageFileRef.current(file));
      input!.value = ""; // allow re-selecting the same file later
    }
    input.addEventListener("change", handleNativeChange);
    return () => {
      input.removeEventListener("change", handleNativeChange);
    };
    // Re-bind whenever the input element itself changes (shouldn't happen in
    // practice, but covers the case where React re-creates the DOM node).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileInputRef.current]);
  // Ref mirror of accountId/editor so the paste/drop handlers (registered
  // once via editorProps, not re-created per render) always see the
  // current values instead of closing over stale ones.
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  // editorProps below is only read at editor-creation time by Tiptap, so
  // handlePaste/handleDrop go through this ref rather than calling
  // insertImageFile directly — it's defined further down (it needs the
  // editor instance itself), and the ref sidesteps any ordering issue.
  const insertImageFileRef = useRef<(file: File) => void>(() => {});

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
      NoteImage.configure({ inline: false, HTMLAttributes: { class: "note-image" } }),
      SlashCommand,
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
      // Clipboard image paste (e.g. a copied chart or screenshot).
      handlePaste: (view, event) => {
        const files = Array.from(event.clipboardData?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => insertImageFileRef.current(file));
        return true;
      },
      // Drag-and-drop from the OS file browser or another app/tab.
      handleDrop: (view, event) => {
        const files = Array.from(event.dataTransfer?.files ?? []).filter((f) => f.type.startsWith("image/"));
        if (files.length === 0) return false;
        event.preventDefault();
        files.forEach((file) => insertImageFileRef.current(file));
        return true;
      },
      // Phase 4 Part 3: click-to-expand — opens the clicked image full-size
      // in a lightbox. Returns false so ProseMirror still runs its normal
      // node-selection behavior on the same click (e.g. so Backspace still
      // deletes a selected image); the setState setter's identity is
      // stable across renders, so closing over it here is safe even though
      // editorProps is only read once at editor creation.
      handleClickOn: (_view, _pos, node) => {
        if (node.type.name === "image") {
          setLightbox({ src: node.attrs.src, alt: node.attrs.alt });
        }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getJSON());
    },
  });

  const insertImageFile = useCallback(
    async (file: File) => {
      const currentAccountId = accountIdRef.current;
      if (!currentAccountId) {
        setImageError("Can't upload an image right now — no account selected.");
        return;
      }
      const invalid = validateScreenshotFile(file);
      if (invalid) {
        setImageError(invalid);
        return;
      }
      setImageError(null);
      setUploadingCount((n) => n + 1);
      try {
        const { url, fileId, error } = await uploadNoteImage(currentAccountId, file);
        if (error || !url) {
          setImageError(error || "Image upload failed. Please try again.");
          return;
        }
        // Node type name is still "image" — NoteImage extends Image's
        // schema (adding the fileId attribute) without renaming it.
        // insertContent can throw (e.g. if the current selection can't
        // hold a block-level node) — caught here so a failed insert shows
        // a friendly message instead of an uncaught exception taking down
        // the whole app.
        // Deferred to the next animation frame: this insert changes the
        // document structure and collapses/moves the selection, which can
        // land in the same React commit as an unrelated DOM update already
        // in flight (e.g. the bubble toolbar hiding) and corrupt React's
        // view of the DOM (NotFoundError on insertBefore). Waiting a frame
        // lets any in-flight DOM/React updates finish first.
        requestAnimationFrame(() => {
          try {
            editor?.chain().focus().insertContent({ type: "image", attrs: { src: url, fileId, alt: file.name } }).run();
          } catch {
            setImageError("Uploaded, but couldn't insert the image here. Try placing your cursor on its own line and pasting again.");
          }
        });
      } catch {
        setImageError("Image upload failed. Please try again.");
      } finally {
        setUploadingCount((n) => n - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [editor]
  );

  useEffect(() => {
    insertImageFileRef.current = insertImageFile;
  }, [insertImageFile]);

  if (!editor) {
    return (
      <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass overflow-hidden">
        <div className="min-h-[280px] animate-pulse bg-surface-2/40" />
      </div>
    );
  }

  return (
    <div className="bg-surface-1 backdrop-blur-md border border-surface-border rounded-panel shadow-glass overflow-hidden">
      {editable && (
        <Toolbar
          editor={editor}
          imagesEnabled={!!accountId}
          onInsertImageClick={() => fileInputRef.current?.click()}
        />
      )}
      {editable && accountId && (
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          className="hidden"
        />
      )}
      {editable && (uploadingCount > 0 || imageError) && (
        <p className={`px-4 pt-1.5 text-[11px] ${imageError ? "text-loss" : "text-ink-muted"}`}>
          {imageError ?? (uploadingCount === 1 ? "Uploading image…" : `Uploading ${uploadingCount} images…`)}
        </p>
      )}
      {editable && <BubbleToolbar editor={editor} />}
      <EditorContent editor={editor} />
      {lightbox && <ImageLightbox src={lightbox.src} alt={lightbox.alt} onClose={() => setLightbox(null)} />}
    </div>
  );
}
