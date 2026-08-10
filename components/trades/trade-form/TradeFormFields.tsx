import { Direction, ExitReason } from "@/lib/trades";
import { Select } from "@/components/shared/Select";
import TagInput from "@/components/shared/TagInput";
import Button from "@/components/shared/Button";
import ScreenshotUploader from "./ScreenshotUploader";
import FormSection from "./FormSection";
import { EXIT_REASON_OPTIONS, MOVEMENT_OPTIONS, UseTradeFormReturn } from "@/hooks/useTradeForm";

const inputClass =
  "mt-1.5 w-full bg-surface-2 border border-surface-border rounded-lg px-3 py-2 text-sm text-ink-primary placeholder:text-ink-muted transition-colors duration-fast focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20 hover:border-surface-border";
const labelClass = "text-xs text-ink-secondary";
// Swapped in for inputClass's border when a field has a validation error
// — same input, just a red border plus focus ring so it's visually
// distinct without changing the layout.
const errorInputClass =
  "mt-1.5 w-full bg-surface-2 border border-loss rounded-lg px-3 py-2 text-sm text-ink-primary transition-colors focus:outline-none focus:ring-2 focus:ring-loss/30";
const fieldErrorTextClass = "mt-1.5 text-[11px] text-loss";
const dividerClass = "border-t border-surface-border";

/** Two/three-across segmented toggle used for direction, SL/TP movement,
 *  and rules-followed — pulled into one helper so all three share exact
 *  sizing/active-state styling instead of three near-identical inline
 *  blocks. */
function SegmentedToggle<T extends string | boolean | null>({
  options,
  value,
  onChange,
  fullWidth = true,
}: {
  options: { label: string; value: T }[];
  value: T;
  onChange: (v: T) => void;
  fullWidth?: boolean;
}) {
  return (
    <div
      className={`mt-1.5 inline-flex gap-1 bg-surface-2 rounded-lg p-1 border border-surface-border ${
        fullWidth ? "w-full" : "w-fit"
      }`}
    >
      {options.map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          className={`${
            fullWidth ? "flex-1" : "px-3.5"
          } py-1.5 rounded-md text-xs font-medium capitalize transition-all duration-fast ${
            value === opt.value
              ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 shadow-glow"
              : "text-ink-secondary hover:text-ink-primary hover:bg-surface-1"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/**
 * All the field markup for TradeFormPanel — dates, instrument, direction,
 * dropdowns, prices, P&L/R-multiple, rules-followed, screenshot, tags,
 * notes, validation errors, and the save/cancel buttons. Takes the whole
 * useTradeForm() return value as `f` rather than ~20 individual props,
 * since nearly every field in the hook is used somewhere in here.
 *
 * Grouped into named FormSections (Timing, Instrument & setup, Prices,
 * Outcome, Execution quality, Attachments & notes) so a ~20-field form
 * reads as a sequence of digestible groups rather than one flat stack —
 * see the trade-journal-webapp memory's design-review history for why.
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
    <div className="p-6 space-y-7">
      <FormSection title="Timing">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>
              Entry date <span className="text-loss">*</span>
            </span>
            <input
              ref={f.registerFieldRef("entry_date")}
              type="date"
              value={form.entry_date}
              onChange={(e) => set("entry_date", e.target.value)}
              className={`${f.fieldErrors.entry_date ? errorInputClass : inputClass} font-mono`}
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
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Exit date</span>
            <input
              type="date"
              value={form.exit_date}
              onChange={(e) => set("exit_date", e.target.value)}
              placeholder="Optional"
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Exit time</span>
            <input
              type="time"
              value={form.exit_time}
              onChange={(e) => set("exit_time", e.target.value)}
              placeholder="Optional"
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>
      </FormSection>

      <div className={dividerClass} />

      <FormSection title="Instrument & setup">
        <label className="block">
          <span className={labelClass}>
            Instrument <span className="text-loss">*</span>
          </span>
          <input
            ref={f.registerFieldRef("instrument")}
            value={form.instrument}
            onChange={(e) => set("instrument", e.target.value)}
            placeholder="e.g. EUR/USD"
            className={f.fieldErrors.instrument ? errorInputClass : inputClass}
          />
          {f.fieldErrors.instrument && (
            <p className={fieldErrorTextClass}>{f.fieldErrors.instrument}</p>
          )}
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Direction</span>
            <SegmentedToggle
              options={(["long", "short"] as Direction[]).map((d) => ({ label: d, value: d }))}
              value={form.direction}
              onChange={(v) => set("direction", v)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Asset class</span>
            <div className="mt-1.5">
              <Select
                value={form.asset_class}
                onChange={(v) => set("asset_class", v)}
                options={f.renderOptions("asset_class", form.asset_class)}
                fullWidth
              />
            </div>
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Strategy</span>
            <div className="mt-1.5">
              <Select
                value={form.strategy}
                onChange={(v) => set("strategy", v)}
                options={f.renderOptions("strategy", form.strategy)}
                fullWidth
              />
            </div>
          </label>
          <label className="block">
            <span className={labelClass}>Session</span>
            <div className="mt-1.5">
              <Select
                value={form.session}
                onChange={(v) => set("session", v)}
                options={f.renderOptions("session", form.session)}
                fullWidth
              />
            </div>
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Emotion</span>
          <div className="mt-1.5">
            <Select
              value={form.emotion}
              onChange={(v) => set("emotion", v)}
              options={f.renderOptions("emotion", form.emotion)}
              fullWidth
            />
          </div>
        </label>
      </FormSection>

      <div className={dividerClass} />

      <FormSection title="Prices & levels">
        <div className="grid grid-cols-3 gap-3">
          <label className="block">
            <span className={labelClass}>Entry price</span>
            <input
              type="number"
              step="any"
              value={form.entry_price}
              onChange={(e) => set("entry_price", e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Exit price</span>
            <input
              type="number"
              step="any"
              value={form.exit_price}
              onChange={(e) => set("exit_price", e.target.value)}
              className={`${inputClass} font-mono`}
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
              className={`${f.fieldErrors.size ? errorInputClass : inputClass} font-mono`}
            />
            {f.fieldErrors.size && <p className={fieldErrorTextClass}>{f.fieldErrors.size}</p>}
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>Stop loss price</span>
            <input
              type="number"
              step="any"
              value={form.stop_loss_price}
              onChange={(e) => set("stop_loss_price", e.target.value)}
              placeholder="Optional — enables R-multiple"
              className={`${inputClass} font-mono`}
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
              className={`${inputClass} font-mono`}
            />
          </label>
        </div>

        <label className="block">
          <span className={labelClass}>Exit reason</span>
          <div className="mt-1.5">
            <Select
              value={form.exit_reason}
              onChange={(v) => set("exit_reason", v as ExitReason | "")}
              options={[{ value: "", label: "—" }, ...EXIT_REASON_OPTIONS]}
              fullWidth
            />
          </div>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className={labelClass}>SL mov&apos;t</span>
            <SegmentedToggle
              options={MOVEMENT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              value={form.sl_movement}
              onChange={(v) => set("sl_movement", form.sl_movement === v ? null : v)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>TP mov&apos;t</span>
            <SegmentedToggle
              options={MOVEMENT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              value={form.tp_movement}
              onChange={(v) => set("tp_movement", form.tp_movement === v ? null : v)}
            />
          </label>
        </div>
      </FormSection>

      <div className={dividerClass} />

      <FormSection title="Outcome">
        <div className="grid grid-cols-2 gap-3">
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
              className={`${f.fieldErrors.pnl ? errorInputClass : inputClass} font-mono text-base font-medium ${
                form.pnl.trim() !== ""
                  ? parseFloat(form.pnl) >= 0
                    ? "text-gain"
                    : "text-loss"
                  : ""
              }`}
            />
            {f.fieldErrors.pnl && <p className={fieldErrorTextClass}>{f.fieldErrors.pnl}</p>}
            {f.pnlAuto && f.computedPnl != null && (
              <span className="text-[11px] text-ink-muted">
                Auto-calculated from entry, exit &amp; size
              </span>
            )}
            {f.pnlMismatch && (
              <div className="mt-1.5 rounded-lg border border-glow/30 bg-glow/10 px-2.5 py-1.5">
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
              className={`${inputClass} font-mono`}
            />
            {f.rAuto && f.computedR != null && (
              <span className="text-[11px] text-ink-muted">
                Auto-calculated from entry, exit &amp; stop loss
              </span>
            )}
          </label>
        </div>
      </FormSection>

      <div className={dividerClass} />

      <FormSection title="Execution quality">
        <label className="block">
          <span className={labelClass}>Followed rules?</span>
          <SegmentedToggle
            fullWidth={false}
            options={[
              { label: "Yes", value: true },
              { label: "No", value: false },
              { label: "Unset", value: null },
            ]}
            value={form.rules_followed}
            onChange={(v) => set("rules_followed", v)}
          />
        </label>
      </FormSection>

      <div className={dividerClass} />

      <FormSection title="Attachments & notes">
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
            className="mt-1.5"
          />
        </label>

        <label className="block">
          <span className={labelClass}>Notes</span>
          <textarea
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={3}
            placeholder="What did you see? What would you do differently?"
            className={`${inputClass} resize-y`}
          />
        </label>
      </FormSection>

      {(Object.keys(f.fieldErrors).length > 0 || f.formError) && (
        <div className={dividerClass} />
      )}

      {Object.keys(f.fieldErrors).length > 0 && (
        <p className="text-xs text-loss">
          This trade couldn&apos;t be logged — check the highlighted field
          {Object.keys(f.fieldErrors).length > 1 ? "s" : ""} above.
        </p>
      )}
      {f.formError && (
        <div className="rounded-lg border border-loss/30 bg-loss/10 px-4 py-3">
          <p className="text-xs text-loss">{f.formError}</p>
        </div>
      )}

      <div className="sticky bottom-0 -mx-6 -mb-6 mt-2 px-6 py-4 bg-surface-solid backdrop-blur-xl border-t border-surface-border flex items-center gap-3">
        <Button size="md" onClick={f.handleSubmit} disabled={f.saving} className="min-w-[9rem]">
          {f.saving ? "Saving…" : isEditing ? "Save changes" : "Add trade"}
        </Button>
        <Button variant="ghost" size="md" onClick={f.requestClose}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
