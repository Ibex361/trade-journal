import { supabase } from "./supabaseClient";

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
const ALLOWED_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

/**
 * True when the browser reported a usable image MIME, or when it reported
 * nothing useful (empty string / octet-stream — common when picking from
 * Android's Files app rather than the gallery) but the filename extension
 * still looks like a supported image. Gallery picks almost always arrive
 * with a clean image/* type; Files-app picks often don't.
 */
function isAllowedImageFile(file: File): boolean {
  const type = (file.type || "").toLowerCase().trim();
  if (ALLOWED_TYPES.includes(type)) return true;
  // Android Files / some desktop file managers leave type blank or set
  // application/octet-stream even for real PNGs/JPEGs.
  if (type === "" || type === "application/octet-stream") {
    const name = (file.name || "").toLowerCase();
    return ALLOWED_EXTENSIONS.some((ext) => name.endsWith(ext));
  }
  return false;
}

export function validateScreenshotFile(file: File): string | null {
  if (!isAllowedImageFile(file)) {
    return "Only PNG, JPG, or WEBP images are supported.";
  }
  if (file.size === 0) {
    return "That file looks empty — try picking it from the gallery instead of Files.";
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

// --- One-time migration: move existing legacy screenshots to ImageKit ---

export type LegacyScreenshotTrade = { id: string; account_id: string; screenshot_url: string };

/** Finds every trade whose screenshot is still sitting in the old Supabase Storage bucket. */
export async function findLegacyScreenshots(): Promise<LegacyScreenshotTrade[]> {
  const { data, error } = await supabase
    .from("trades")
    .select("id, account_id, screenshot_url")
    .is("screenshot_file_id", null)
    .not("screenshot_url", "is", null)
    .ilike("screenshot_url", `%/${LEGACY_SCREENSHOT_BUCKET}/%`);
  if (error) {
    console.error("findLegacyScreenshots failed:", error);
    return [];
  }
  return (data ?? []) as LegacyScreenshotTrade[];
}

/**
 * Moves one trade's screenshot off Supabase Storage: downloads the existing
 * image, re-uploads it to ImageKit (via the same route/private-key path as
 * a normal upload), repoints the trade row at the new location, then removes
 * the original from Supabase Storage now that nothing references it.
 */
export async function migrateLegacyScreenshot(trade: LegacyScreenshotTrade): Promise<{ error: string | null }> {
  let blob: Blob;
  try {
    const res = await fetch(trade.screenshot_url);
    if (!res.ok) return { error: `Couldn't download the existing screenshot (${res.status}).` };
    blob = await res.blob();
  } catch {
    return { error: "Couldn't download the existing screenshot." };
  }

  // Supabase doesn't always report a usable image/* content-type for these
  // older uploads — fall back to guessing from the file extension so
  // validateScreenshotFile doesn't reject a perfectly good image over that.
  const ext = trade.screenshot_url.split(".").pop()?.split("?")[0]?.toLowerCase() || "png";
  const inferredType = ext === "webp" ? "image/webp" : ext === "jpg" || ext === "jpeg" ? "image/jpeg" : "image/png";
  const mimeType = ALLOWED_TYPES.includes(blob.type) ? blob.type : inferredType;
  const file = new File([blob], `legacy.${ext}`, { type: mimeType });

  const { url, fileId, error: uploadError } = await uploadScreenshot(trade.account_id, file);
  if (uploadError || !url || !fileId) {
    return { error: uploadError || "Upload to ImageKit failed." };
  }

  const { error: dbError } = await supabase
    .from("trades")
    .update({ screenshot_url: url, screenshot_file_id: fileId })
    .eq("id", trade.id);
  if (dbError) {
    return { error: "Uploaded to ImageKit, but couldn't update the trade record." };
  }

  // Best-effort cleanup — the trade row no longer points at this file.
  await deleteLegacySupabaseScreenshots([trade.screenshot_url]);

  return { error: null };
}
