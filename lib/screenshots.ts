import { supabase } from "./supabaseClient";

// Must match the bucket name created by supabase/phase2b_storage_migration.sql
export const SCREENSHOT_BUCKET = "trade-screenshots";

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

/**
 * Uploads a chart screenshot for a given account and returns its public URL.
 * Files are namespaced by account so screenshots never mix between accounts.
 */
export async function uploadScreenshot(
  accountId: string,
  file: File
): Promise<{ url: string | null; error: string | null }> {
  const invalid = validateScreenshotFile(file);
  if (invalid) return { url: null, error: invalid };

  const ext = file.name.split(".").pop()?.toLowerCase() || "png";
  const filename = `${crypto.randomUUID()}.${ext}`;
  const path = `${accountId}/${filename}`;

  const { error } = await supabase.storage.from(SCREENSHOT_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });

  if (error) return { url: null, error: error.message };

  const { data } = supabase.storage.from(SCREENSHOT_BUCKET).getPublicUrl(path);
  return { url: data.publicUrl, error: null };
}

function pathFromPublicUrl(url: string): string | null {
  const marker = `/${SCREENSHOT_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length);
}

/** Removes a previously-uploaded screenshot from storage, given its public URL. */
export async function deleteScreenshotByUrl(url: string): Promise<void> {
  const path = pathFromPublicUrl(url);
  if (!path) return;
  await supabase.storage.from(SCREENSHOT_BUCKET).remove([path]);
}
