import { RefObject } from "react";
import Image from "next/image";
import imagekitLoader, { isRemoteScreenshotUrl } from "@/lib/imagekitLoader";

/**
 * Chart screenshot picker for TradeFormPanel: empty-state "+ Add
 * screenshot" button, or a preview with Replace/Remove once one is staged
 * or already saved. Pulled out of TradeFormPanel — see useTradeForm for
 * the state/handlers this wires up to.
 */
export default function ScreenshotUploader({
  labelClass,
  fileInputRef,
  screenshotPreview,
  screenshotError,
  uploadingScreenshot,
  onSelect,
  onRemove,
}: {
  labelClass: string;
  fileInputRef: RefObject<HTMLInputElement>;
  screenshotPreview: string | null;
  screenshotError: string | null;
  uploadingScreenshot: boolean;
  onSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="block">
      <span className={`${labelClass} block mb-1.5`}>Chart screenshot</span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onSelect}
        className="hidden"
      />
      {screenshotPreview ? (
        <div className="relative w-full max-w-[260px] aspect-video rounded-xl overflow-hidden border border-surface-border shadow-glass">
          {isRemoteScreenshotUrl(screenshotPreview) ? (
            <Image
              loader={imagekitLoader}
              src={screenshotPreview}
              alt="Trade chart screenshot preview"
              fill
              className="object-cover"
              sizes="220px"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local blob: preview from URL.createObjectURL right after picking a file, before upload completes; not an ImageKit URL the loader/optimizer can handle.
            <img
              src={screenshotPreview}
              alt="Trade chart screenshot preview"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-end gap-3 bg-surface-0/80 backdrop-blur px-3 py-1.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-[11px] text-glow hover:underline"
            >
              Replace
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-[11px] text-loss hover:underline"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group w-full rounded-xl border border-dashed border-surface-border bg-surface-2/60 px-4 py-6 flex flex-col items-center gap-2 text-center transition-all duration-fast hover:border-glow/50 hover:bg-glow/5"
        >
          <span className="w-9 h-9 rounded-full bg-surface-2 border border-surface-border flex items-center justify-center text-ink-secondary transition-colors group-hover:border-glow/50 group-hover:text-glow">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <rect x="3" y="5" width="18" height="14" rx="2.5" />
              <circle cx="9" cy="10.5" r="1.75" />
              <path d="M21 16l-5.5-5.5a1.5 1.5 0 0 0-2.1 0L4 19" />
            </svg>
          </span>
          <span className="text-xs font-medium text-ink-secondary group-hover:text-ink-primary transition-colors">
            Add chart screenshot
          </span>
          <span className="text-[11px] text-ink-muted">PNG, JPG, or WEBP · up to 5MB</span>
        </button>
      )}
      {uploadingScreenshot && (
        <p className="mt-1.5 text-[11px] text-ink-muted">Uploading screenshot…</p>
      )}
      {screenshotError && <p className="mt-1.5 text-[11px] text-loss">{screenshotError}</p>}
      {/* The empty-state dropzone already states the format/size limit
          inline, so this line only repeats it once a screenshot exists
          (a preview no longer shows that hint itself). */}
      {screenshotPreview && !screenshotError && !uploadingScreenshot && (
        <p className="mt-1.5 text-[11px] text-ink-muted">PNG, JPG, or WEBP, up to 5MB.</p>
      )}
    </div>
  );
}
