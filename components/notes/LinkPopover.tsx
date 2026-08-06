"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";

import { isMarkInSchema, sanitizeUrl } from "@/lib/tiptapUtils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/notes/Popover";
import { ToolbarButton } from "@/components/notes/Toolbar";

/**
 * Link popover — adapted from Tiptap's own UI Components library
 * (tiptap-ui/link-popover + use-link-popover.ts, MIT licensed:
 * github.com/ueberdosis/tiptap-ui-components), real source pulled
 * directly from the full repo zip (same source used for the Color
 * highlight popover port).
 *
 * Real, kept-as-is logic from their source (this is the actual value of
 * this port over the old LinkDialog modal, not just a visual change):
 * - Auto-populates the URL field from the link under the cursor, and
 *   keeps it live via the editor's `selectionUpdate` event — so clicking
 *   into an existing link shows its current URL immediately, and the
 *   popover auto-opens when the cursor lands inside one
 *   (`autoOpenOnLinkActive`), letting you edit a link in place instead
 *   of re-adding it.
 * - Applying a link on an empty selection inserts the URL itself as the
 *   link text (`insertContent`), matching what happens when you paste a
 *   bare URL — the old dialog required an existing selection.
 * - Removing a link sets `preventAutolink` in the transaction meta, so
 *   Tiptap's autolink extension doesn't immediately re-linkify the same
 *   text on the very next keystroke.
 * - "Open in new window" runs the URL through `sanitizeUrl` first — a
 *   real security check (rejects `javascript:` etc.), not decorative —
 *   before ever calling `window.open`.
 *
 * Real, deliberate differences from their source:
 * - `Card`/`CardBody`/`CardItemGroup`/`ButtonGroup`/`Button` primitives
 *   replaced with plain divs + this app's own `ToolbarButton`, same
 *   consolidation already done for the Color highlight popover — this
 *   app doesn't have that primitive family and one popover's contents
 *   isn't reason enough to introduce it.
 * - `Input`/`InputGroup` adapted inline as a styled `<input>` rather than
 *   a separate primitive file — their real `input.tsx` is a 15-line
 *   className wrapper with no logic of its own, not worth a new file for
 *   one caller.
 * - Icons are inline SVG matching this app's existing icon style
 *   (every other ToolbarButton in NoteEditor.tsx does the same) instead
 *   of their separate icon-component files.
 * - `useTiptapEditor`'s context-fallback is already dropped app-wide (see
 *   hooks/useTiptapEditor.ts's own comment from the Color highlight
 *   popover pass) — same here, editor is always passed as a prop.
 */

function canSetLink(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false;
  return editor.can().setMark("link");
}

function isLinkActive(editor: Editor | null): boolean {
  if (!editor || !editor.isEditable) return false;
  return editor.isActive("link");
}

/** Mirrors their real useLinkHandler: URL state + the four link actions. */
function useLinkHandler(editor: Editor | null) {
  const [url, setUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!editor) return;
    const { href } = editor.getAttributes("link");
    if (isLinkActive(editor) && url === null) {
      setUrl(href || "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  React.useEffect(() => {
    if (!editor) return;
    const updateLinkState = () => {
      const { href } = editor.getAttributes("link");
      setUrl(href || "");
    };
    editor.on("selectionUpdate", updateLinkState);
    return () => {
      editor.off("selectionUpdate", updateLinkState);
    };
  }, [editor]);

  const setLink = React.useCallback(() => {
    if (!url || !editor) return;
    const { selection } = editor.state;
    const isEmpty = selection.empty;
    let chain = editor.chain().focus();
    chain = chain.extendMarkRange("link").setLink({ href: url });
    if (isEmpty) {
      chain = chain.insertContent({ type: "text", text: url });
    }
    chain.run();
    setUrl(null);
  }, [editor, url]);

  const removeLink = React.useCallback(() => {
    if (!editor) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().setMeta("preventAutolink", true).run();
    setUrl("");
  }, [editor]);

  const openLink = React.useCallback(() => {
    if (!url) return;
    const safeUrl = sanitizeUrl(url, window.location.href);
    if (safeUrl !== "#") {
      window.open(safeUrl, "_blank", "noopener,noreferrer");
    }
  }, [url]);

  return { url: url || "", setUrl, setLink, removeLink, openLink };
}

interface LinkPopoverContentProps {
  url: string;
  setUrl: React.Dispatch<React.SetStateAction<string | null>>;
  setLink: () => void;
  removeLink: () => void;
  openLink: () => void;
  isActive: boolean;
}

function LinkPopoverContent({ url, setUrl, setLink, removeLink, openLink, isActive }: LinkPopoverContentProps) {
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      event.preventDefault();
      setLink();
    }
  };

  const disabled = !url && !isActive;

  return (
    <div className="flex items-center gap-1.5 p-2">
      <input
        type="url"
        placeholder="Paste a link..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        className="w-56 bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-sm text-ink-primary placeholder:text-ink-muted focus:outline-none focus:border-glow/50 focus:ring-1 focus:ring-glow/50"
      />
      <ToolbarButton label="Apply link" onClick={setLink} disabled={disabled}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M9 10L4 15l5 5" />
          <path d="M4 15h11a4 4 0 000-8h-1" />
        </svg>
      </ToolbarButton>
      <span className="w-px h-6 bg-surface-border shrink-0" role="separator" aria-orientation="vertical" />
      <ToolbarButton label="Open in new window" onClick={openLink} disabled={disabled}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" />
          <path d="M15 3h6v6" />
          <path d="M10 14L21 3" />
        </svg>
      </ToolbarButton>
      <ToolbarButton label="Remove link" onClick={removeLink} disabled={disabled}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
          <path d="M3 6h18" />
          <path d="M8 6V4a1 1 0 011-1h6a1 1 0 011 1v2" />
          <path d="M19 6l-1 14a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

export interface LinkPopoverProps {
  editor?: Editor | null;
  /** @default true — auto-opens the popover when the cursor lands inside an existing link. */
  autoOpenOnLinkActive?: boolean;
}

export function LinkPopover({ editor, autoOpenOnLinkActive = true }: LinkPopoverProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const { url, setUrl, setLink, removeLink, openLink } = useLinkHandler(editor ?? null);

  const canSet = canSetLink(editor ?? null);
  const isActive = isLinkActive(editor ?? null);

  React.useEffect(() => {
    if (autoOpenOnLinkActive && isActive) {
      setIsOpen(true);
    }
  }, [autoOpenOnLinkActive, isActive]);

  const handleSetLink = React.useCallback(() => {
    setLink();
    setIsOpen(false);
  }, [setLink]);

  if (!isMarkInSchema("link", editor ?? null)) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Link" active={isActive || isOpen} disabled={!canSet} onClick={() => {}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4">
            <path d="M9 15l6-6" />
            <path d="M11 6l1-1a3.5 3.5 0 015 5l-1 1" />
            <path d="M13 18l-1 1a3.5 3.5 0 01-5-5l1-1" />
          </svg>
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent aria-label="Link">
        <LinkPopoverContent url={url} setUrl={setUrl} setLink={handleSetLink} removeLink={removeLink} openLink={openLink} isActive={isActive} />
      </PopoverContent>
    </Popover>
  );
}

export default LinkPopover;
