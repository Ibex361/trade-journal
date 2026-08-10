import { Direction, ExitReason } from "@/lib/trades";
import { Select } from "@/components/shared/Select";
import TagInput from "@/components/shared/TagInput";
import Button from "@/components/shared/Button";
import ScreenshotUploader from "./ScreenshotUploader";
import { EXIT_REASON_OPTIONS, MOVEMENT_OPTIONS, UseTradeFormReturn } from "@/hooks/useTradeForm";

const selectClass =
  "mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm";
const labelClass = "text-xs text-ink-secondary";
// Swapped in for selectClass's border when a field has a validation error
// — same input, just a red border plus focus ring so it's visually
// distinct without changing the layout.
const errorInputClass =
  "mt-1 w-full bg-surface-2 border border-loss rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-loss";
const fieldErrorTextClass = "mt-1 text-[11px] text-loss";

/**
 * All the field markup for TradeFormPanel — dates, instrument, direction,
 * dropdowns, prices, P&L/R-multiple, rules-followed, screenshot, tags,
 * notes, validation errors, and the save/cancel buttons. Takes the whole
 * useTradeForm() return value as `f` rather than ~20 individual props,
 * since nearly every field in the hook is used somewhere in here.
 */
export default function TradeFormFields({
  f,
  isEditing,
}: {
  f: UseTradeFormReturn;
  isEditing: boolean;
}) {
  const { form, set } = f;

  return (
    <div className="p-6 space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>
            Entry date <span className="text-loss">*</span>
          </span>
          <input
            ref={f.registerFieldRef("entry_date")}
            type="date"
            value={form.entry_date}
            onChange={(e) => set("entry_date", e.target.value)}
            className={`${f.fieldErrors.entry_date ? errorInputClass : selectClass} font-mono`}
          />
          {f.fieldErrors.entry_date && (
            <p className={fieldErrorTextClass}>{f.fieldErrors.entry_date}</p>
          )}
        </label>
        <label className="block">
          <span className={labelClass}>Entry time</span>
          <input
            type="time"
            value={form.entry_time}
            onChange={(e) => set("entry_time", e.target.value)}
            placeholder="Optional"
            className={`${selectClass} font-mono`}
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Exit date</span>
          <input
            type="date"
            value={form.exit_date}
            onChange={(e) => set("exit_date", e.target.value)}
            placeholder="Optional"
            className={`${selectClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Exit time</span>
          <input
            type="time"
            value={form.exit_time}
            onChange={(e) => set("exit_time", e.target.value)}
            placeholder="Optional"
            className={`${selectClass} font-mono`}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>
          Instrument <span className="text-loss">*</span>
        </span>
        <input
          ref={f.registerFieldRef("instrument")}
          value={form.instrument}
          onChange={(e) => set("instrument", e.target.value)}
          placeholder="e.g. EUR/USD"
          className={f.fieldErrors.instrument ? errorInputClass : selectClass}
        />
        {f.fieldErrors.instrument && (
          <p className={fieldErrorTextClass}>{f.fieldErrors.instrument}</p>
        )}
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Direction</span>
          <div className="mt-1 flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border">
            {(["long", "short"] as Direction[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => set("direction", d)}
                className={`flex-1 py-1.5 rounded-full text-xs capitalize transition-colors ${
                  form.direction === d
                    ? "bg-glow text-surface-0 font-medium"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className={labelClass}>Asset class</span>
          <Select
            value={form.asset_class}
            onChange={(v) => set("asset_class", v)}
            options={f.renderOptions("asset_class", form.asset_class)}
            fullWidth
          />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Strategy</span>
          <Select
            value={form.strategy}
            onChange={(v) => set("strategy", v)}
            options={f.renderOptions("strategy", form.strategy)}
            fullWidth
          />
        </label>
        <label className="block">
          <span className={labelClass}>Session</span>
          <Select
            value={form.session}
            onChange={(v) => set("session", v)}
            options={f.renderOptions("session", form.session)}
            fullWidth
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Emotion</span>
        <Select
          value={form.emotion}
          onChange={(v) => set("emotion", v)}
          options={f.renderOptions("emotion", form.emotion)}
          fullWidth
        />
      </label>

      <div className="grid grid-cols-3 gap-4">
        <label className="block">
          <span className={labelClass}>Entry price</span>
          <input
            type="number"
            step="any"
            value={form.entry_price}
            onChange={(e) => set("entry_price", e.target.value)}
            className={`${selectClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Exit price</span>
          <input
            type="number"
            step="any"
            value={form.exit_price}
            onChange={(e) => set("exit_price", e.target.value)}
            className={`${selectClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Size</span>
          <input
            ref={f.registerFieldRef("size")}
            type="number"
            step="any"
            value={form.size}
            onChange={(e) => set("size", e.target.value)}
            className={`${f.fieldErrors.size ? errorInputClass : selectClass} font-mono`}
          />
          {f.fieldErrors.size && <p className={fieldErrorTextClass}>{f.fieldErrors.size}</p>}
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>Stop loss price</span>
          <input
            type="number"
            step="any"
            value={form.stop_loss_price}
            onChange={(e) => set("stop_loss_price", e.target.value)}
            placeholder="Optional — enables R-multiple"
            className={`${selectClass} font-mono`}
          />
        </label>
        <label className="block">
          <span className={labelClass}>Take profit price</span>
          <input
            type="number"
            step="any"
            value={form.take_profit_price}
            onChange={(e) => set("take_profit_price", e.target.value)}
            placeholder="Optional"
            className={`${selectClass} font-mono`}
          />
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Exit reason</span>
        <Select
          value={form.exit_reason}
          onChange={(v) => set("exit_reason", v as ExitReason | "")}
          options={[{ value: "", label: "—" }, ...EXIT_REASON_OPTIONS]}
          fullWidth
        />
      </label>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <span className={labelClass}>SL mov&apos;t</span>
          <div className="mt-1 flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border">
            {MOVEMENT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => set("sl_movement", form.sl_movement === o.value ? null : o.value)}
                className={`flex-1 py-1.5 rounded-full text-[11px] transition-colors ${
                  form.sl_movement === o.value
                    ? "bg-glow text-surface-0 font-medium"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </label>
        <label className="block">
          <span className={labelClass}>TP mov&apos;t</span>
          <div className="mt-1 flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border">
            {MOVEMENT_OPTIONS.map((o) => (
              <button
                key={o.value}
                type="button"
                onClick={() => set("tp_movement", form.tp_movement === o.value ? null : o.value)}
                className={`flex-1 py-1.5 rounded-full text-[11px] transition-colors ${
                  form.tp_movement === o.value
                    ? "bg-glow text-surface-0 font-medium"
                    : "text-ink-secondary hover:text-ink-primary"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </label>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <label className="block">
          <div className="flex items-center justify-between">
            <span className={labelClass}>P&amp;L ({f.selectedAccount?.currency ?? "USD"})</span>
            {!f.pnlAuto && f.computedPnl != null && (
              <button
                type="button"
                onClick={f.resetPnlToAuto}
                className="text-[11px] text-glow hover:underline"
              >
                Use calculated
              </button>
            )}
          </div>
          <input
            ref={f.registerFieldRef("pnl")}
            type="number"
            step="any"
            value={form.pnl}
            onChange={(e) => f.handlePnlChange(e.target.value)}
            className={`${f.fieldErrors.pnl ? errorInputClass : selectClass} font-mono`}
          />
          {f.fieldErrors.pnl && <p className={fieldErrorTextClass}>{f.fieldErrors.pnl}</p>}
          {f.pnlAuto && f.computedPnl != null && (
            <span className="text-[11px] text-ink-muted">
              Auto-calculated from entry, exit &amp; size
            </span>
          )}
          {f.pnlMismatch && (
            <div className="mt-1.5 rounded-md border border-glow/30 bg-glow/10 px-2.5 py-1.5">
              <p className="text-[11px] text-glow leading-snug">
                This P&amp;L doesn&apos;t match what entry/exit/size imply
                (calculated: {f.pnlMismatch.computed.toFixed(2)}, entered:{" "}
                {f.pnlMismatch.manual.toFixed(2)}). Keep it if that&apos;s
                intentional — e.g. fees or slippage — or{" "}
                <button
                  type="button"
                  onClick={f.resetPnlToAuto}
                  className="underline hover:no-underline"
                >
                  use the calculated value
                </button>
                .
              </p>
            </div>
          )}
        </label>
        <label className="block">
          <div className="flex items-center justify-between">
            <span className={labelClass}>R-multiple</span>
            {!f.rAuto && f.computedR != null && (
              <button
                type="button"
                onClick={f.resetRToAuto}
                className="text-[11px] text-glow hover:underline"
              >
                Use calculated
              </button>
            )}
          </div>
          <input
            type="number"
            step="any"
            value={form.r_multiple}
            onChange={(e) => f.handleRChange(e.target.value)}
            className={`${selectClass} font-mono`}
          />
          {f.rAuto && f.computedR != null && (
            <span className="text-[11px] text-ink-muted">
              Auto-calculated from entry, exit &amp; stop loss
            </span>
          )}
        </label>
      </div>

      <label className="block">
        <span className={labelClass}>Followed rules?</span>
        <div className="mt-1 flex gap-1 bg-surface-2 rounded-full p-1 border border-surface-border w-fit">
          {[
            { label: "Yes", value: true },
            { label: "No", value: false },
            { label: "Unset", value: null },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={() => set("rules_followed", opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs transition-colors ${
                form.rules_followed === opt.value
                  ? "bg-glow text-surface-0 font-medium"
                  : "text-ink-secondary hover:text-ink-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </label>

      <ScreenshotUploader
        labelClass={labelClass}
        fileInputRef={f.fileInputRef}
        screenshotPreview={f.screenshotPreview}
        screenshotError={f.screenshotError}
        uploadingScreenshot={f.uploadingScreenshot}
        onSelect={f.handleScreenshotSelect}
        onRemove={f.handleRemoveScreenshot}
      />

      <label className="block">
        <span className={labelClass}>Tags</span>
        <TagInput
          value={form.tags}
          onChange={(tags) => set("tags", tags)}
          suggestions={f.tagSuggestions}
          chipClassName="bg-glow/15 border-glow text-glow"
        />
      </label>

      <label className="block">
        <span className={labelClass}>Notes</span>
        <textarea
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          className={selectClass}
        />
      </label>

      {Object.keys(f.fieldErrors).length > 0 && (
        <p className="text-xs text-loss">
          This trade couldn&apos;t be logged — check the highlighted field
          {Object.keys(f.fieldErrors).length > 1 ? "s" : ""} above.
        </p>
      )}
      {f.formError && (
        <div className="rounded-md border border-loss/30 bg-loss/10 px-4 py-3">
          <p className="text-xs text-loss">{f.formError}</p>
        </div>
      )}

      <div className="flex items-center gap-3 pt-2">
        <Button size="sm" onClick={f.handleSubmit} disabled={f.saving}>
          {f.saving ? "Saving…" : isEditing ? "Save changes" : "Add trade"}
        </Button>
        <Button variant="ghost" size="sm" onClick={f.requestClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
