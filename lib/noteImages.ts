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
