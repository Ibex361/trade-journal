import type { ChangeEvent, RefObject } from "react";
import Image from "next/image";
import imagekitLoader, { isRemoteScreenshotUrl } from "@/lib/imagekitLoader";

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
  onSelect: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: () => void;
}) {
  return (
    <div className="block">
      <div className="mb-2 flex items-end justify-between gap-3">
        <span className={labelClass}>Chart screenshot</span>
        <span className="text-[10px] text-ink-muted">Optional · 5MB max</span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        onChange={onSelect}
        className="hidden"
      />

      {screenshotPreview ? (
        <div className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-surface-border bg-surface-2 shadow-glass">
          {isRemoteScreenshotUrl(screenshotPreview) ? (
            <Image
              loader={imagekitLoader}
              src={screenshotPreview}
              alt="Trade chart screenshot preview"
              fill
              className="object-cover transition-transform duration-base group-hover:scale-[1.01]"
              sizes="(max-width: 640px) 100vw, 640px"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element -- local blob preview before ImageKit upload completes.
            <img
              src={screenshotPreview}
              alt="Trade chart screenshot preview"
              className="h-full w-full object-cover transition-transform duration-base group-hover:scale-[1.01]"
            />
          )}
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-between bg-surface-0/80 px-3 py-2 backdrop-blur-md">
            <span className="text-[10px] text-ink-secondary">Chart attached</span>
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileInputRef.current?.click()} className="text-[11px] font-medium text-glow hover:underline">
                Replace
              </button>
              <button type="button" onClick={onRemove} className="text-[11px] font-medium text-loss hover:underline">
                Remove
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group flex w-full items-center gap-4 rounded-2xl border border-dashed border-surface-border bg-surface-2/60 px-4 py-5 text-left transition-all hover:border-glow/40 hover:bg-surface-2"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-glow/20 bg-glow/5 text-glow transition-colors group-hover:bg-glow/10">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <rect x="3" y="4" width="18" height="16" rx="2" />
              <circle cx="8.5" cy="9" r="1.5" />
              <path d="M3 16l4.5-4.5 3.5 3 2.5-2.5L21 16" />
            </svg>
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-ink-primary">Add a chart screenshot</span>
            <span className="mt-0.5 block text-[11px] text-ink-muted">PNG, JPG, or WEBP · up to 5MB</span>
          </span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto h-4 w-4 shrink-0 text-ink-muted transition-transform group-hover:translate-x-0.5 group-hover:text-glow">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </button>
      )}

      {uploadingScreenshot && <p className="mt-2 text-[11px] text-glow">Uploading screenshot…</p>}
      {screenshotError && <p className="mt-2 text-[11px] text-loss">{screenshotError}</p>}
    </div>
  );
}
