"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";
import { useHotkeys } from "react-hotkeys-hook";

import { useIsMobile } from "@/hooks/useIsMobile";
import { useMenuNavigation } from "@/hooks/useMenuNavigation";
import { useTiptapEditor } from "@/hooks/useTiptapEditor";
import { isMarkInSchema, isNodeTypeSelected } from "@/lib/tiptapUtils";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/notes/Popover";
import { ToolbarButton } from "@/components/notes/Toolbar";

/**
 * Color highlight popover — adapted from Tiptap's own UI Components
 * library (tiptap-ui/color-highlight-popover + color-highlight-button,
 * MIT licensed: github.com/ueberdosis/tiptap-ui-components), using the
 * real source you pasted in directly for color-highlight-popover.tsx as
 * the reference.
 *
 * Real, deliberate differences from their source:
 * - Their version splits this across two components + a hook
 *   (`ColorHighlightButton`/`useColorHighlight` in a separate
 *   color-highlight-button module, consumed by this popover). Folded
 *   into one file here since nothing else in this app needs the
 *   standalone swatch button or the hook independently — same
 *   consolidation this app already did for Toolbar's primitives.
 * - Their palette is 10 colors (yellow/green/blue/purple/red/gray/
 *   brown/orange/pink/default); kept to the 5 their own Simple Editor
 *   template actually ships by default, using this app's dark-theme
 *   values (see the --highlight-* tokens added to app/globals.css)
 *   instead of their light/dark CSS variable pairs.
 * - `Card`/`CardBody`/`CardItemGroup`/`ButtonGroup`/`Button` primitives
 *   replaced with plain divs + this app's existing `ToolbarButton`,
 *   styled inline to match — introducing a whole second button
 *   primitive family for one popover's contents wasn't worth it.
 * - Keyboard grid navigation (useMenuNavigation, real port, not a
 *   simplification) is kept; the "highlighted item click via
 *   [data-highlighted='true'] query selector" trick from their source
 *   is kept as-is since it's how onSelect reaches the right swatch
 *   without duplicating the color-click handler.
 * - `useColorHighlight`'s `canColorHighlight`/`isActive`/visibility
 *   checks are inlined directly rather than factored into a separate
 *   hook, since (per the point above) nothing else consumes it
 *   independently.
 * - Badge/Tooltip-based shortcut display dropped (see the fixed
 *   toolbar's Code block button comment for the same reasoning
 *   elsewhere in this file) — the Cmd/Ctrl+Shift+H shortcut itself is
 *   kept and real, just not visually advertised in a badge.
 */

export interface HighlightColor {
  label: string;
  value: string;
  border?: string;
}

const DEFAULT_COLORS: HighlightColor[] = [
  { label: "Yellow", value: "var(--highlight-yellow)" },
  { label: "Green", value: "var(--highlight-green)" },
  { label: "Blue", value: "var(--highlight-blue)" },
  { label: "Purple", value: "var(--highlight-purple)" },
  { label: "Red", value: "var(--highlight-red)" },
];

function canToggleHighlight(editor: Editor | null): boolean {
  if (!editor) return false;
  if (!isMarkInSchema("highlight", editor)) return false;
  if (isNodeTypeSelected(editor, ["image"])) return false;
  return editor.can().toggleMark("highlight");
}

interface SwatchButtonProps {
  editor: Editor | null;
  color: HighlightColor;
  isSelected: boolean;
  onApplied: () => void;
}

function SwatchButton({ editor, color, isSelected, onApplied }: SwatchButtonProps) {
  const isActive = editor?.isActive("highlight", { color: color.value }) ?? false;

  const handleClick = () => {
    if (!editor) return;
    // Deferred with setTimeout, matching their real source — toggling a
    // mark synchronously inside a popover's item-click handler can race
    // with Radix's own focus-return-to-trigger behavior on close.
    setTimeout(() => {
      editor.chain().focus().toggleMark("highlight", { color: color.value }).run();
      onApplied();
    }, 0);
  };

  return (
    <button
      type="button"
      role="menuitem"
      aria-label={`${color.label} highlight color`}
      title={color.label}
      tabIndex={isSelected ? 0 : -1}
      data-highlighted={isSelected}
      onClick={handleClick}
      className={[
        "h-7 w-7 rounded-full shrink-0 transition-transform duration-fast motion-safe:hover:scale-110",
        "ring-1 ring-inset ring-surface-border",
        isActive || isSelected ? "outline outline-2 outline-offset-2 outline-glow" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ background: color.value }}
    />
  );
}

interface ColorHighlightPopoverContentProps {
  editor: Editor | null;
  colors?: HighlightColor[];
  onApplied: () => void;
}

function ColorHighlightPopoverContent({ editor, colors = DEFAULT_COLORS, onApplied }: ColorHighlightPopoverContentProps) {
  const isMobile = useIsMobile();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleRemoveHighlight = React.useCallback(() => {
    if (!editor) return;
    setTimeout(() => {
      editor.chain().focus().unsetMark("highlight").run();
      onApplied();
    }, 0);
  }, [editor, onApplied]);

  const menuItems = React.useMemo(
    () => [...colors, { label: "Remove highlight", value: "none" }],
    [colors]
  );

  const { selectedIndex } = useMenuNavigation({
    containerRef,
    items: menuItems,
    orientation: "both",
    onSelect: (item) => {
      if (!containerRef.current) return false;
      const highlighted = containerRef.current.querySelector('[data-highlighted="true"]') as HTMLElement | null;
      if (highlighted) highlighted.click();
      if (item.value === "none") handleRemoveHighlight();
      return true;
    },
    autoSelectFirstItem: false,
  });

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="flex items-center gap-2 p-2 outline-none"
      style={isMobile ? { padding: 0 } : undefined}
    >
      <div className="flex items-center gap-1.5">
        {colors.map((color, index) => (
          <SwatchButton key={color.value} editor={editor} color={color} isSelected={selectedIndex === index} onApplied={onApplied} />
        ))}
      </div>
      <span className="w-px h-6 bg-surface-border shrink-0" role="separator" aria-orientation="vertical" />
      <ToolbarButton
        label="Remove highlight"
        onClick={handleRemoveHighlight}
        active={selectedIndex === colors.length}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
          <circle cx="12" cy="12" r="9" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </ToolbarButton>
    </div>
  );
}

export interface ColorHighlightPopoverProps {
  editor?: Editor | null;
  colors?: HighlightColor[];
}

export function ColorHighlightPopover({ editor: providedEditor, colors = DEFAULT_COLORS }: ColorHighlightPopoverProps) {
  const { editor } = useTiptapEditor(providedEditor);
  const [isOpen, setIsOpen] = React.useState(false);

  const canHighlight = canToggleHighlight(editor);
  const isActive = editor?.isActive("highlight") ?? false;

  useHotkeys(
    "mod+shift+h",
    (event) => {
      event.preventDefault();
      setIsOpen((open) => !open);
    },
    { enabled: canHighlight, enableOnContentEditable: true },
    [canHighlight]
  );

  if (!isMarkInSchema("highlight", editor)) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <ToolbarButton label="Highlight" active={isActive || isOpen} disabled={!canHighlight} onClick={() => {}}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
            <path d="M9 11l6-6 4 4-6 6H9v-4z" />
            <path d="M5 21l3-3" />
          </svg>
        </ToolbarButton>
      </PopoverTrigger>
      <PopoverContent aria-label="Highlight colors">
        <ColorHighlightPopoverContent editor={editor} colors={colors} onApplied={() => setIsOpen(false)} />
      </PopoverContent>
    </Popover>
  );
}

export default ColorHighlightPopover;
