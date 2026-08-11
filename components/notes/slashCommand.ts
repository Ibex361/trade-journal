import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionOptions } from "@tiptap/suggestion";
import { ReactRenderer } from "@tiptap/react";
import tippy, { type Instance as TippyInstance } from "tippy.js";
import SlashCommandList, { type SlashCommandListHandle } from "./SlashCommandList";
import { SLASH_COMMAND_ITEMS, type SlashCommandItem } from "./slashCommandItems";

/**
 * Notes/diary — Phase 2 part 3.
 *
 * Typing "/" at the start of a query opens a filterable popup of block
 * types (heading, list, table, etc.) — an alternative to hunting for a
 * button on the toolbar. Built on Tiptap's own @tiptap/suggestion utility
 * (the same plugin the official Mention extension is built on) positioned
 * with tippy.js, rather than a heavier UI-kit combo — keeps this in line
 * with the rest of the app's hand-rolled popovers (see AccountSwitcher)
 * and avoids a second component-library aesthetic.
 */

const suggestion: Omit<SuggestionOptions<SlashCommandItem>, "editor"> = {
  char: "/",
  startOfLine: false,
  allow: ({ editor }) => !editor.isActive("codeBlock"),
  items: ({ query }) =>
    SLASH_COMMAND_ITEMS.filter((item) =>
      item.title.toLowerCase().startsWith(query.toLowerCase())
    ).slice(0, 10),
  command: ({ editor, range, props }) => {
    props.command({ editor, range });
  },
  render: () => {
    let component: ReactRenderer<SlashCommandListHandle>;
    let popup: TippyInstance[];

    return {
      onStart: (props) => {
        component = new ReactRenderer(SlashCommandList, {
          // props.command is the Suggestion plugin's own selection callback —
          // calling it with an item routes back through this extension's
          // top-level `command` option above, which runs that item's
          // .command(). Forwarding it directly (rather than calling
          // item.command ourselves) keeps the plugin's own cleanup of the
          // "/query" decoration correctly sequenced with the block change.
          props: { items: props.items, command: props.command },
          editor: props.editor,
        });

        if (!props.clientRect) return;

        popup = tippy("body", {
          getReferenceClientRect: props.clientRect as () => DOMRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: "manual",
          placement: "bottom-start",
          animation: false,
        });
      },
      onUpdate(props) {
        component.updateProps({ items: props.items, command: props.command });
        if (!props.clientRect) return;
        popup[0]?.setProps({ getReferenceClientRect: props.clientRect as () => DOMRect });
      },
      onKeyDown(props) {
        if (props.event.key === "Escape") {
          popup[0]?.hide();
          return true;
        }
        return component.ref?.onKeyDown(props) ?? false;
      },
      onExit() {
        popup[0]?.destroy();
        component.destroy();
      },
    };
  },
};

const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return { suggestion };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export default SlashCommand;
