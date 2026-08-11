import Image from "@tiptap/extension-image";

/**
 * Notes Phase 4 Part 1 — Tiptap's stock Image extension only tracks src/
 * alt/title. We extend it with a `fileId` attribute (rendered as
 * data-file-id on the <img>) so a later save can walk the doc, diff which
 * ImageKit files are still referenced, and delete the ones that were
 * removed — the same "we own deletion, ImageKit doesn't" approach
 * lib/screenshots.ts already uses for trade charts. Not read yet (that's
 * Phase 4 Part 3); recorded now so every image ever inserted has it from
 * the start rather than needing a backfill later.
 */
const NoteImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      fileId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute("data-file-id"),
        renderHTML: (attributes: { fileId?: string | null }) => {
          if (!attributes.fileId) return {};
          return { "data-file-id": attributes.fileId };
        },
      },
    };
  },
});

export default NoteImage;
