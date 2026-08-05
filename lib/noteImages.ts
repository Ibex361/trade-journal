import type { JSONContent } from "@tiptap/react";
import { validateScreenshotFile } from "./screenshots";

/**
 * Notes Phase 4 Part 1 — image upload for the note editor (paste/drag-drop
 * and manual insert). Deliberately a thin sibling of lib/screenshots.ts
 * rather than a shared function: trade screenshots are a single field on a
 * trade row (one upload replaces the old one), while note images are many
 * per note, embedded inline in the Tiptap doc, and their lifecycle
 * (deleting orphaned ones when removed from the doc or when a note is
 * deleted) is handled separately in Notes Phase 4 Part 3. Sharing just the
 * validation logic keeps both call sites simple without conflating them.
 *
 * Uploads go through the same /api/screenshots/upload route as trade
 * screenshots (same ImageKit private key, same server-only constraint),
 * just tagged with context "note-images" so they land in their own
 * ImageKit folder instead of mixing with trade charts.
 */
export async function uploadNoteImage(
  accountId: string,
  file: File
): Promise<{ url: string | null; fileId: string | null; error: string | null }> {
  const invalid = validateScreenshotFile(file);
  if (invalid) return { url: null, fileId: null, error: invalid };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("accountId", accountId);
  formData.append("context", "note-images");

  try {
    const res = await fetch("/api/screenshots/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      return { url: null, fileId: null, error: data.error || "Image upload failed. Please try again." };
    }
    return { url: data.url, fileId: data.fileId, error: null };
  } catch {
    return { url: null, fileId: null, error: "Image upload failed. Please try again." };
  }
}

/**
 * Notes Phase 4 Part 3 — walks a Tiptap doc and collects every image
 * node's fileId (deduped, nulls dropped — an image somehow missing one,
 * e.g. from before NoteImage recorded it, just can't be cleaned up
 * automatically). Used to diff old vs. new content on save (see
 * app/notes/page.tsx's handleSaveNote) and to collect everything to remove
 * when a note itself is deleted (handleDeleteNote).
 */
export function extractImageFileIds(content: JSONContent): string[] {
  const ids = new Set<string>();

  function walk(node: JSONContent) {
    if (node.type === "image" && typeof node.attrs?.fileId === "string") {
      ids.add(node.attrs.fileId);
    }
    node.content?.forEach(walk);
  }

  walk(content);
  return Array.from(ids);
}

/**
 * Removes previously-uploaded note images from ImageKit. Reuses the same
 * /api/screenshots/delete route trade screenshots use — it deletes by
 * ImageKit fileId regardless of which folder/context the file was
 * uploaded under, so nothing route-side needed to change for this.
 *
 * Always best-effort: called after a note save/delete has already
 * succeeded, so a failure here (network blip, file already gone, etc.)
 * shouldn't surface as an error to the user or block what they were
 * doing — worst case a file lingers in ImageKit, same trade-off
 * lib/screenshots.ts's deleteScreenshots already accepts.
 */
export async function deleteNoteImages(fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  await fetch("/api/screenshots/delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fileIds }),
  }).catch(() => {});
}
