"use client";

import * as React from "react";
import type { Editor } from "@tiptap/react";

/**
 * Keyboard navigation for menu-like grids of items (dropdown menus,
 * command palettes, color swatch pickers). Ported from Tiptap's own UI
 * Components library (hooks/use-menu-navigation.ts, MIT licensed:
 * github.com/ueberdosis/tiptap-ui-components) — no dependencies, no
 * behavioral changes from the real source.
 *
 * This is the real shared hook that this app's Toolbar.tsx primitive
 * (components/notes/Toolbar.tsx) explicitly flagged as missing when it
 * was first ported — that file reimplemented similar roving-focus logic
 * by hand with a plain useEffect. This hook and Toolbar's own roving
 * focus solve slightly different problems (this is index-based selection
 * for a grid of items driven from a ref/editor keydown listener; Toolbar's
 * is DOM-tabIndex-based roving focus across real <button> elements) so
 * they're kept separate rather than unifying them in this pass.
 */

type Orientation = "horizontal" | "vertical" | "both";

interface MenuNavigationOptions<T> {
  editor?: Editor | null;
  containerRef?: React.RefObject<HTMLElement | null>;
  query?: string;
  items: T[];
  onSelect?: (item: T) => void;
  onClose?: () => void;
  orientation?: Orientation;
  autoSelectFirstItem?: boolean;
}

export function useMenuNavigation<T>({
  editor,
  containerRef,
  query,
  items,
  onSelect,
  onClose,
  orientation = "vertical",
  autoSelectFirstItem = true,
}: MenuNavigationOptions<T>) {
  const [selectedIndex, setSelectedIndex] = React.useState<number>(autoSelectFirstItem ? 0 : -1);

  React.useEffect(() => {
    const handleKeyboardNavigation = (event: KeyboardEvent) => {
      if (!items.length) return false;

      const moveNext = () =>
        setSelectedIndex((currentIndex) => {
          if (currentIndex === -1) return 0;
          return (currentIndex + 1) % items.length;
        });

      const movePrev = () =>
        setSelectedIndex((currentIndex) => {
          if (currentIndex === -1) return items.length - 1;
          return (currentIndex - 1 + items.length) % items.length;
        });

      switch (event.key) {
        case "ArrowUp": {
          if (orientation === "horizontal") return false;
          event.preventDefault();
          movePrev();
          return true;
        }
        case "ArrowDown": {
          if (orientation === "horizontal") return false;
          event.preventDefault();
          moveNext();
          return true;
        }
        case "ArrowLeft": {
          if (orientation === "vertical") return false;
          event.preventDefault();
          movePrev();
          return true;
        }
        case "ArrowRight": {
          if (orientation === "vertical") return false;
          event.preventDefault();
          moveNext();
          return true;
        }
        case "Tab": {
          event.preventDefault();
          if (event.shiftKey) movePrev();
          else moveNext();
          return true;
        }
        case "Home": {
          event.preventDefault();
          setSelectedIndex(0);
          return true;
        }
        case "End": {
          event.preventDefault();
          setSelectedIndex(items.length - 1);
          return true;
        }
        case "Enter": {
          if (event.isComposing) return false;
          event.preventDefault();
          if (selectedIndex !== -1 && items[selectedIndex]) {
            onSelect?.(items[selectedIndex]);
          }
          return true;
        }
        case "Escape": {
          event.preventDefault();
          onClose?.();
          return true;
        }
        default:
          return false;
      }
    };

    let targetElement: HTMLElement | null = null;
    if (editor) {
      targetElement = editor.view.dom;
    } else if (containerRef?.current) {
      targetElement = containerRef.current;
    }

    if (targetElement) {
      targetElement.addEventListener("keydown", handleKeyboardNavigation, true);
      return () => {
        targetElement?.removeEventListener("keydown", handleKeyboardNavigation, true);
      };
    }
    return undefined;
  }, [editor, containerRef, items, selectedIndex, onSelect, onClose, orientation]);

  React.useEffect(() => {
    if (query) {
      // Resets the selection as the search query changes, so a stale
      // index from the previous filtered list isn't left selected.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(autoSelectFirstItem ? 0 : -1);
    }
  }, [query, autoSelectFirstItem]);

  return {
    selectedIndex: items.length ? selectedIndex : undefined,
    setSelectedIndex,
  };
}
