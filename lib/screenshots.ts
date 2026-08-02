import { supabase } from "./supabaseClient";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateScreenshotFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return "Only PNG, JPG, or WEBP images are supported.";
  }
  if (file.size > MAX_SIZE_BYTES) {
    return "Image must be smaller than 5MB.";
  }
  return null;
}

/** What's needed to later delete a screenshot — see deleteScreenshot(s) below. */
export type ScreenshotRef = { url: string; fileId: string | null };

/**
 * Uploads a chart screenshot for a given account to ImageKit and returns
 * its delivery URL plus the ImageKit file ID (needed to delete it later).
 * Namespaced by account, same as the old Supabase Storage layout, so
 * screenshots never mix between accounts.
 *
 * This posts to our own /api/screenshots/upload route rather than calling
 * ImageKit directly — the upload is authenticated with ImageKit's private
 * key, which must stay server-side and never reach the browser.
 */
export async function uploadScreenshot(
  accountId: string,
  file: File
): Promise<{ url: string | null; fileId: string | null; error: string | null }> {
  const invalid = validateScreenshotFile(file);
  if (invalid) return { url: null, fileId: null, error: invalid };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("accountId", accountId);

  try {
    const res = await fetch("/api/screenshots/upload", { method: "POST", body: formData });
    const data = await res.json();
    if (!res.ok) {
      return { url: null, fileId: null, error: data.error || "Screenshot upload failed. Please try again." };
    }
    return { url: data.url, fileId: data.fileId, error: null };
  } catch {
    return { url: null, fileId: null, error: "Screenshot upload failed. Please try again." };
  }
}

/** Removes a previously-uploaded screenshot. See deleteScreenshots for the fileId/legacy split. */
export async function deleteScreenshot(ref: ScreenshotRef): Promise<void> {
  return deleteScreenshots([ref]);
}

/**
 * Removes multiple previously-uploaded screenshots in one batch.
 *
 * Screenshots uploaded going forward live in ImageKit and carry a fileId —
 * those are deleted via our /api/screenshots/delete route. Screenshots
 * uploaded before this migration have no fileId; they're still sitting in
 * the original Supabase Storage bucket, so those fall back to the old
 * delete-by-path method below rather than silently never being cleaned up.
 */
export async function deleteScreenshots(refs: ScreenshotRef[]): Promise<void> {
  const imageKitFileIds = refs.map((r) => r.fileId).filter((id): id is string => !!id);
  const legacyUrls = refs.filter((r) => !r.fileId).map((r) => r.url);

  const tasks: Promise<unknown>[] = [];

  if (imageKitFileIds.length > 0) {
    tasks.push(
      fetch("/api/screenshots/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: imageKitFileIds }),
      }).catch(() => {})
    );
  }
  if (legacyUrls.length > 0) {
    tasks.push(deleteLegacySupabaseScreenshots(legacyUrls));
  }

  await Promise.all(tasks);
}

// --- Legacy path: screenshots uploaded before the ImageKit migration ---
// Must match the bucket name created by supabase/phase2b_storage_migration.sql
const LEGACY_SCREENSHOT_BUCKET = "trade-screenshots";

function legacyPathFromPublicUrl(url: string): string | null {
  const marker = `/${LEGACY_SCREENSHOT_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

async function deleteLegacySupabaseScreenshots(urls: string[]): Promise<void> {
  const paths = urls.map(legacyPathFromPublicUrl).filter((p): p is string => p !== null);
  if (paths.length === 0) return;
  await supabase.storage.from(LEGACY_SCREENSHOT_BUCKET).remove(paths);
}
