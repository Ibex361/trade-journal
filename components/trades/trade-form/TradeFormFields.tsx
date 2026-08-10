import { Direction, ExitReason } from "@/lib/trades";
import { Select } from "@/components/shared/Select";
import TagInput from "@/components/shared/TagInput";
import Button from "@/components/shared/Button";
import ScreenshotUploader from "./ScreenshotUploader";
import FormSection from "./FormSection";
import { EXIT_REASON_OPTIONS, MOVEMENT_OPTIONS, UseTradeFormReturn } from "@/hooks/useTradeForm";

const inputClass =
  "mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-2.5 py-1.5 text-xs text-ink-primary placeholder:text-ink-muted transition-colors duration-fast focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20 hover:border-surface-border";
const labelClass = "text-[11px] text-ink-muted";
// Swapped in for inputClass's border when a field has a validation error
// — same input, just a red border plus focus ring so it's visually
// distinct without changing the layout.
const errorInputClass =
  "mt-1 w-full bg-surface-2 border border-loss rounded-md px-2.5 py-1.5 text-xs text-ink-primary transition-colors focus:outline-none focus:ring-2 focus:ring-loss/30";
const fieldErrorTextClass = "mt-1 text-[11px] text-loss";

/** Two/three-across segmented toggle used for direction, SL/TP movement,
 *  and rules-followed — pulled into one helper so all three share exact
 *  sizing/active-state styling instead of three near-identical inline
 *  blocks.
 *
 *  `tone` picks which color the active pill uses: "accent" (the default
 *  teal-violet gradient — used wherever the options aren't themselves
 *  good/bad) or "directional", which colors the active pill by which
 *  option is picked (long/"Yes"-shaped choices read teal, short/"No"-
 *  shaped choices read coral) so a Short position doesn't visually read
 *  identically to a Long one. */
function SegmentedToggle<T extends string | boolean | null>({
  options,
  value,
  onChange,
  fullWidth = true,
  tone = "accent",
  size = "md",
}: {
  options: { label: string; value: T; sentiment?: "positive" | "negative" }[];
  value: T;
  onChange: (v: T) => void;
  fullWidth?: boolean;
  tone?: "accent" | "directional";
  size?: "md" | "sm";
}) {
  const padding = size === "sm" ? "py-1.5" : "py-2";
  const text = size === "sm" ? "text-[11px]" : "text-xs";
  return (
    <div
      className={`mt-1 inline-flex gap-1 bg-surface-2 rounded-lg p-1 border border-surface-border ${
        fullWidth ? "w-full" : "w-fit"
      }`}
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const activeClass =
          tone === "directional"
            ? opt.sentiment === "negative"
              ? "bg-gradient-to-b from-loss to-loss/70 text-surface-0 shadow-glow-loss"
              : "bg-gradient-to-b from-glow to-glow-dim text-surface-0 shadow-glow"
            : "bg-gradient-to-r from-glow to-glow-violet text-surface-0 shadow-glow";
        return (
          <button
            key={opt.label}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`${fullWidth ? "flex-1" : "px-3.5"} ${padding} rounded-md ${text} font-semibold uppercase tracking-wide transition-all duration-fast ${
              active
                ? activeClass
                : "text-ink-secondary hover:text-ink-primary hover:bg-surface-1"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
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
 * Grouped into panel-card FormSections rather than a single flat stack:
 * Position (instrument, direction, asset class/strategy/session/emotion
 * — the "ticket header" fields a trader reads first), Timing, Prices &
 * levels, Outcome (hero-treated — the section a trader scans for),
 * Execution quality (single-line, low visual weight), Attachments &
 * notes. See the trade-journal-webapp memory's design-review history for
 * the reasoning behind grouping generally and this pass specifically.
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
    <div className="p-5 space-y-3">
      <FormSection title="Position">
        <div className="grid grid-cols-[1fr_auto] gap-3">
          <label className="block">
            <span className={labelClass}>
              Instrument <span className="text-loss">*</span>
            </span>
            <input
              ref={f.registerFieldRef("instrument")}
              value={form.instrument}
              onChange={(e) => set("instrument", e.target.value)}
              placeholder="e.g. EUR/USD"
              className={`${
                f.fieldErrors.instrument ? errorInputClass : inputClass
              } !text-sm font-display font-semibold tracking-tight`}
            />
            {f.fieldErrors.instrument && (
              <p className={fieldErrorTextClass}>{f.fieldErrors.instrument}</p>
            )}
          </label>
          <label className="block">
            <span className={labelClass}>Direction</span>
            <SegmentedToggle
              fullWidth={false}
              tone="directional"
              options={(["long", "short"] as Direction[]).map((d) => ({
                label: d,
                value: d,
                sentiment: d === "short" ? "negative" : "positive",
              }))}
              value={form.direction}
              onChange={(v) => set("direction", v)}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <label className="block">
            <span className={labelClass}>Asset class</span>
            <Select
              value={form.asset_class}
              onChange={(v) => set("asset_class", v)}
              options={f.renderOptions("asset_class", form.asset_class)}
              className="mt-1"
              fullWidth
            />
          </label>
          <label className="block">
            <span className={labelClass}>Strategy</span>
            <Select
              value={form.strategy}
              onChange={(v) => set("strategy", v)}
              options={f.renderOptions("strategy", form.strategy)}
              className="mt-1"
              fullWidth
            />
          </label>
          <label className="block">
            <span className={labelClass}>Session</span>
            <Select
              value={form.session}
              onChange={(v) => set("session", v)}
              options={f.renderOptions("session", form.session)}
              className="mt-1"
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
            className="mt-1"
            fullWidth
          />
        </label>
      </FormSection>

      <FormSection title="Timing">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
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

      <FormSection title="Prices & levels">
        <div className="grid grid-cols-3 gap-2.5">
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

        <div className="grid grid-cols-2 gap-2.5">
          <label className="block">
            <span className={labelClass}>Stop loss price</span>
            <input
              type="number"
              step="any"
              value={form.stop_loss_price}
              onChange={(e) => set("stop_loss_price", e.target.value)}
              placeholder="Optional — enables R-multiple"
              // Tinted borders (loss/gain at low opacity, not a full
              // errorInputClass swap) so a trader can tell "this is the
              // downside level" / "this is the upside level" apart at a
              // glance without reading labels — purely a hint, doesn't
              // affect validation or the neutral focus ring.
              className={`${inputClass} font-mono !border-loss/25`}
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
              className={`${inputClass} font-mono !border-glow/25`}
            />
          </label>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <label className="block">
            <span className={labelClass}>Exit reason</span>
            <Select
              value={form.exit_reason}
              onChange={(v) => set("exit_reason", v as ExitReason | "")}
              options={[{ value: "", label: "—" }, ...EXIT_REASON_OPTIONS]}
              className="mt-1"
              fullWidth
            />
          </label>
          <label className="block">
            <span className={labelClass}>SL mov&apos;t</span>
            <SegmentedToggle
              size="sm"
              options={MOVEMENT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              value={form.sl_movement}
              onChange={(v) => set("sl_movement", form.sl_movement === v ? null : v)}
            />
          </label>
          <label className="block">
            <span className={labelClass}>TP mov&apos;t</span>
            <SegmentedToggle
              size="sm"
              options={MOVEMENT_OPTIONS.map((o) => ({ label: o.label, value: o.value }))}
              value={form.tp_movement}
              onChange={(v) => set("tp_movement", form.tp_movement === v ? null : v)}
            />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Outcome"
        className="!border-glow/20"
        // Subtle two-tone wash instead of a plain panel-card fill — the
        // section a trader's eye should land on first after a save, so it
        // gets the one piece of "hero" treatment on the form rather than
        // every section fighting for the same attention.
        style={{
          background:
            "linear-gradient(135deg, rgba(92,230,200,0.05), rgba(124,111,240,0.03))",
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <div className="flex items-center justify-between">
              <span className={labelClass}>P&amp;L ({f.selectedAccount?.currency ?? "USD"})</span>
              {!f.pnlAuto && f.computedPnl != null ? (
                <button
                  type="button"
                  onClick={f.resetPnlToAuto}
                  className="text-[11px] text-glow hover:underline"
                >
                  Use calculated
                </button>
              ) : f.pnlAuto && f.computedPnl != null ? (
                <span className="text-[10px] text-ink-muted italic">auto</span>
              ) : null}
            </div>
            <input
              ref={f.registerFieldRef("pnl")}
              type="number"
              step="any"
              value={form.pnl}
              onChange={(e) => f.handlePnlChange(e.target.value)}
              className={`mt-1 w-full rounded-lg px-3 py-2.5 text-xl font-mono font-bold transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-glow/20 ${
                f.fieldErrors.pnl
                  ? "border border-loss bg-surface-2"
                  : f.pnlAuto
                    ? "data-field"
                    : "border border-surface-border bg-surface-2"
              } ${
                form.pnl.trim() !== ""
                  ? parseFloat(form.pnl) >= 0
                    ? "text-gain"
                    : "text-loss"
                  : "text-ink-primary"
              }`}
            />
            {f.fieldErrors.pnl && <p className={fieldErrorTextClass}>{f.fieldErrors.pnl}</p>}
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
              {!f.rAuto && f.computedR != null ? (
                <button
                  type="button"
                  onClick={f.resetRToAuto}
                  className="text-[11px] text-glow hover:underline"
                >
                  Use calculated
                </button>
              ) : f.rAuto && f.computedR != null ? (
                <span className="text-[10px] text-ink-muted italic">auto</span>
              ) : null}
            </div>
            <input
              type="number"
              step="any"
              value={form.r_multiple}
              onChange={(e) => f.handleRChange(e.target.value)}
              className={`mt-1 w-full rounded-lg px-3 py-2.5 text-xl font-mono font-bold text-ink-primary focus:outline-none focus:ring-2 focus:ring-glow/20 ${
                f.rAuto ? "data-field" : "border border-surface-border bg-surface-2"
              }`}
            />
          </label>
        </div>
      </FormSection>

      <FormSection
        title="Followed rules?"
        headerAction={
          <SegmentedToggle
            fullWidth={false}
            size="sm"
            options={[
              { label: "Yes", value: true },
              { label: "No", value: false },
              { label: "Unset", value: null },
            ]}
            value={form.rules_followed}
            onChange={(v) => set("rules_followed", v)}
          />
        }
      >
        {null}
      </FormSection>

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
            className="mt-1"
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
        <div className="pt-1">
          {Object.keys(f.fieldErrors).length > 0 && (
            <p className="text-xs text-loss">
              This trade couldn&apos;t be logged — check the highlighted field
              {Object.keys(f.fieldErrors).length > 1 ? "s" : ""} above.
            </p>
          )}
          {f.formError && (
            <div className="mt-2 rounded-lg border border-loss/30 bg-loss/10 px-4 py-3">
              <p className="text-xs text-loss">{f.formError}</p>
            </div>
          )}
        </div>
      )}

      <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 px-5 py-3.5 bg-surface-solid backdrop-blur-xl border-t border-surface-border flex items-center gap-3">
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
