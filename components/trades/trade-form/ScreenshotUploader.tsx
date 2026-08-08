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
      <span className={`${labelClass} block mb-1`}>Chart screenshot</span>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onSelect}
        className="hidden"
      />
      {screenshotPreview ? (
        <div className="relative w-full max-w-[220px] aspect-video rounded-md overflow-hidden border border-surface-border">
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
          className="w-full rounded-md border border-dashed border-surface-border bg-surface-2 px-3 py-4 text-center text-xs text-ink-secondary hover:text-ink-primary hover:border-glow/50 transition-colors"
        >
          + Add screenshot
        </button>
      )}
      {uploadingScreenshot && (
        <p className="mt-1 text-[11px] text-ink-muted">Uploading screenshot…</p>
      )}
      {screenshotError && <p className="mt-1 text-[11px] text-loss">{screenshotError}</p>}
      {!screenshotError && !uploadingScreenshot && (
        <p className="mt-1 text-[11px] text-ink-muted">PNG, JPG, or WEBP, up to 5MB.</p>
      )}
    </div>
  );
}
