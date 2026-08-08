/**
 * Custom `next/image` loader that asks ImageKit itself to resize/optimize,
 * instead of routing through Next's built-in image optimizer.
 *
 * Why: Next's default optimizer is a Vercel/Node-server feature — it won't
 * necessarily work the same way (or at all, without extra config) if this
 * app is ever hosted somewhere else. ImageKit already does resizing,
 * format conversion, and CDN caching on its own infrastructure, so this
 * loader just builds an ImageKit transformation URL and lets ImageKit do
 * the work — host-agnostic, and avoids double-optimizing an image that's
 * already served from a CDN built for exactly this.
 *
 * ImageKit URL-based transformations: https://imagekit.io/docs/transformations
 */
export default function imagekitLoader({
  src,
  width,
  quality,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  // Screenshot preview URLs can be local blob: URLs mid-upload (see
  // ScreenshotUploader) — those never reach this loader (callers gate on
  // isRemoteScreenshotUrl first), but bail out safely if one ever does.
  if (src.startsWith("blob:") || src.startsWith("data:")) {
    return src;
  }

  const params = [`w-${width}`, `q-${quality ?? 80}`];
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}tr=${params.join(",")}`;
}

/**
 * True for a real ImageKit delivery URL; false for a local blob:/data:
 * object URL (the transient state right after picking a file, before
 * upload completes) that the ImageKit loader can't do anything with.
 */
export function isRemoteScreenshotUrl(url: string): boolean {
  return url.startsWith("https://ik.imagekit.io/");
}
