import type { ReactNode } from "react";
import { Direction, ExitReason } from "@/lib/trades";
import { Select } from "@/components/shared/Select";
import TagInput from "@/components/shared/TagInput";
import Button from "@/components/shared/Button";
import ScreenshotUploader from "./ScreenshotUploader";
import { EXIT_REASON_OPTIONS, MOVEMENT_OPTIONS, UseTradeFormReturn } from "@/hooks/useTradeForm";

const inputClass =
  "mt-1 w-full rounded-xl border border-surface-border bg-surface-2 px-3.5 py-2.5 text-sm text-ink-primary outline-none transition-all placeholder:text-ink-muted hover:border-white/[0.14] focus:border-glow/60 focus:bg-surface-2/90 focus:ring-2 focus:ring-glow/10";
const errorInputClass =
  "mt-1 w-full rounded-xl border border-loss/80 bg-loss/[0.06] px-3.5 py-2.5 text-sm text-ink-primary outline-none transition-all placeholder:text-ink-muted focus:border-loss focus:ring-2 focus:ring-loss/10";
const labelClass = "text-[11px] font-medium uppercase tracking-[0.08em] text-ink-secondary";
const fieldErrorTextClass = "mt-1.5 text-[11px] text-loss";

function Section({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-white/[0.06] px-5 py-6 last:border-b-0 sm:px-7 sm:py-7">
      <div className="mb-5">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-glow/80">{eyebrow}</div>
        <h3 className="mt-1 font-display text-base font-semibold text-ink-primary">{title}</h3>
        {description && <p className="mt-1 text-xs leading-relaxed text-ink-muted">{description}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="flex items-center justify-between gap-3">
        <span className={labelClass}>
          {label} {required && <span className="text-loss">*</span>}
        </span>
        {hint && <span className="text-[10px] text-ink-muted">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

function Segmented({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { label: string; value: string }[];
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={`mt-1 flex min-h-11 rounded-xl border border-surface-border bg-surface-2 p-1 ${className}`}>
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-2 py-2 text-xs font-medium transition-all ${
              active
                ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0 shadow-sm"
                : "text-ink-secondary hover:bg-white/[0.04] hover:text-ink-primary"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export default function TradeFormFields({
  f,
  isEditing,
}: {
  f: UseTradeFormReturn;
  isEditing: boolean;
}) {
  const { form, set } = f;
  const directionOptions = [
    { label: "Long", value: "long" },
    { label: "Short", value: "short" },
  ];
  const movementOptions = MOVEMENT_OPTIONS.map((o) => ({ label: o.label, value: o.value }));

  return (
    <div className="pb-28">
      <Section
        eyebrow="01 · Essentials"
        title="When and what did you trade?"
        description="Start with the facts. These are the fields you need to identify the trade."
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Field label="Entry date" required>
            <input
              ref={f.registerFieldRef("entry_date")}
              type="date"
              value={form.entry_date}
              onChange={(e) => set("entry_date", e.target.value)}
              aria-invalid={!!f.fieldErrors.entry_date}
              className={`${f.fieldErrors.entry_date ? errorInputClass : inputClass} font-mono`}
            />
            {f.fieldErrors.entry_date && <p className={fieldErrorTextClass}>{f.fieldErrors.entry_date}</p>}
          </Field>
          <Field label="Entry time" hint="Optional">
            <input
              type="time"
              value={form.entry_time}
              onChange={(e) => set("entry_time", e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Exit date" hint="Optional">
            <input
              type="date"
              value={form.exit_date}
              onChange={(e) => set("exit_date", e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </Field>
          <Field label="Exit time" hint="Optional">
            <input
              type="time"
              value={form.exit_time}
              onChange={(e) => set("exit_time", e.target.value)}
              className={`${inputClass} font-mono`}
            />
          </Field>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-[1.4fr_0.9fr]">
          <Field label="Instrument" required>
            <input
              ref={f.registerFieldRef("instrument")}
              value={form.instrument}
              onChange={(e) => set("instrument", e.target.value)}
              placeholder="e.g. EUR/USD"
              aria-invalid={!!f.fieldErrors.instrument}
              className={f.fieldErrors.instrument ? errorInputClass : inputClass}
            />
            {f.fieldErrors.instrument && <p className={fieldErrorTextClass}>{f.fieldErrors.instrument}</p>}
          </Field>
          <Field label="Direction">
            <Segmented options={directionOptions} value={form.direction} onChange={(v) => set("direction", v as Direction)} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="02 · Context"
        title="Describe the setup"
        description="The market context makes the raw trade useful when you review it later."
      >
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <Field label="Asset class">
            <Select value={form.asset_class} onChange={(v) => set("asset_class", v)} options={f.renderOptions("asset_class", form.asset_class)} fullWidth />
          </Field>
          <Field label="Strategy">
            <Select value={form.strategy} onChange={(v) => set("strategy", v)} options={f.renderOptions("strategy", form.strategy)} fullWidth />
          </Field>
          <Field label="Session">
            <Select value={form.session} onChange={(v) => set("session", v)} options={f.renderOptions("session", form.session)} fullWidth />
          </Field>
          <Field label="Emotion">
            <Select value={form.emotion} onChange={(v) => set("emotion", v)} options={f.renderOptions("emotion", form.emotion)} fullWidth />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="03 · Execution"
        title="Record the position"
        description="Prices, size and planned levels. Numeric values use a monospace face for faster scanning."
      >
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
          <Field label="Entry price">
            <input type="number" step="any" value={form.entry_price} onChange={(e) => set("entry_price", e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Exit price">
            <input type="number" step="any" value={form.exit_price} onChange={(e) => set("exit_price", e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Size" required>
            <input
              ref={f.registerFieldRef("size")}
              type="number"
              step="any"
              value={form.size}
              onChange={(e) => set("size", e.target.value)}
              aria-invalid={!!f.fieldErrors.size}
              className={`${f.fieldErrors.size ? errorInputClass : inputClass} font-mono`}
            />
            {f.fieldErrors.size && <p className={fieldErrorTextClass}>{f.fieldErrors.size}</p>}
          </Field>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          <Field label="Stop loss" hint="Optional">
            <input type="number" step="any" value={form.stop_loss_price} onChange={(e) => set("stop_loss_price", e.target.value)} placeholder="Enables R-multiple" className={`${inputClass} font-mono`} />
          </Field>
          <Field label="Take profit" hint="Optional">
            <input type="number" step="any" value={form.take_profit_price} onChange={(e) => set("take_profit_price", e.target.value)} className={`${inputClass} font-mono`} />
          </Field>
        </div>
      </Section>

      <Section
        eyebrow="04 · Outcome"
        title="How did it finish?"
        description="Capture the actual exit and what happened to your plan during the trade."
      >
        <Field label="Exit reason">
          <Select
            value={form.exit_reason}
            onChange={(v) => set("exit_reason", v as ExitReason | "")}
            options={[{ value: "", label: "No exit reason" }, ...EXIT_REASON_OPTIONS]}
            fullWidth
          />
        </Field>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4">
          <Field label="Stop loss movement">
            <Segmented options={movementOptions} value={form.sl_movement} onChange={(v) => set("sl_movement", v as typeof form.sl_movement)} />
          </Field>
          <Field label="Take profit movement">
            <Segmented options={movementOptions} value={form.tp_movement} onChange={(v) => set("tp_movement", v as typeof form.tp_movement)} />
          </Field>
        </div>

        <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3.5 sm:p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-semibold text-ink-primary">Performance</div>
              <p className="mt-0.5 text-[11px] text-ink-muted">Use the calculated value unless your broker result includes something extra.</p>
            </div>
            <span className="hidden rounded-full border border-glow/20 bg-glow/5 px-2 py-1 text-[10px] font-medium text-glow sm:inline">Auto-aware</span>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            <Field label={`P&L (${f.selectedAccount?.currency ?? "USD"})`} required>
              <div className="relative">
                <input
                  ref={f.registerFieldRef("pnl")}
                  type="number"
                  step="any"
                  value={form.pnl}
                  onChange={(e) => f.handlePnlChange(e.target.value)}
                  aria-invalid={!!f.fieldErrors.pnl}
                  className={`${f.fieldErrors.pnl ? errorInputClass : inputClass} pr-24 font-mono text-base font-medium`}
                />
                {f.pnlAuto && f.computedPnl != null && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-glow">CALCULATED</span>
                )}
              </div>
              {f.fieldErrors.pnl && <p className={fieldErrorTextClass}>{f.fieldErrors.pnl}</p>}
              {!f.pnlAuto && f.computedPnl != null && (
                <button type="button" onClick={f.resetPnlToAuto} className="mt-1.5 text-[11px] text-glow hover:underline">
                  Use calculated value ({f.computedPnl.toFixed(2)})
                </button>
              )}
              {f.pnlMismatch && (
                <div className="mt-2 rounded-xl border border-glow/20 bg-glow/5 px-3 py-2">
                  <p className="text-[11px] leading-relaxed text-glow">
                    Entered {f.pnlMismatch.manual.toFixed(2)} vs calculated {f.pnlMismatch.computed.toFixed(2)}. Keep it if fees/slippage explain the difference, or use the calculated value.
                  </p>
                </div>
              )}
            </Field>

            <Field label="R-multiple">
              <input type="number" step="any" value={form.r_multiple} onChange={(e) => f.handleRChange(e.target.value)} className={`${inputClass} font-mono text-base font-medium`} />
              {f.rAuto && f.computedR != null && <span className="mt-1.5 block text-[11px] text-ink-muted">Calculated from entry, exit & stop loss</span>}
              {!f.rAuto && f.computedR != null && (
                <button type="button" onClick={f.resetRToAuto} className="mt-1.5 text-[11px] text-glow hover:underline">
                  Use calculated value ({f.computedR.toFixed(2)}R)
                </button>
              )}
            </Field>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="05 · Review"
        title="What should you remember?"
        description="A few high-signal details turn a trade log into a useful review tool."
      >
        <Field label="Rules followed">
          <div className="mt-1 inline-flex rounded-xl border border-surface-border bg-surface-2 p-1">
            {[
              { label: "Yes", value: true },
              { label: "No", value: false },
              { label: "Unset", value: null },
            ].map((option) => {
              const active = form.rules_followed === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => set("rules_followed", option.value)}
                  className={`min-w-16 rounded-lg px-3 py-2 text-xs font-medium transition-all ${active ? "bg-gradient-to-r from-glow to-glow-violet text-surface-0" : "text-ink-secondary hover:bg-white/[0.04] hover:text-ink-primary"}`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </Field>

        <div className="mt-6">
          <ScreenshotUploader
            labelClass={labelClass}
            fileInputRef={f.fileInputRef}
            screenshotPreview={f.screenshotPreview}
            screenshotError={f.screenshotError}
            uploadingScreenshot={f.uploadingScreenshot}
            onSelect={f.handleScreenshotSelect}
            onRemove={f.handleRemoveScreenshot}
          />
        </div>

        <div className="mt-6">
          <Field label="Tags" hint="Optional">
            <TagInput
              value={form.tags}
              onChange={(tags) => set("tags", tags)}
              suggestions={f.tagSuggestions}
              chipClassName="border-glow/30 bg-glow/10 text-glow"
            />
          </Field>
        </div>

        <div className="mt-6">
          <Field label="Notes" hint="Optional">
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={4}
              placeholder="What did you see, feel, execute well, or miss?"
              className={`${inputClass} resize-y leading-relaxed`}
            />
          </Field>
        </div>

        {Object.keys(f.fieldErrors).length > 0 && (
          <div className="mt-6 rounded-2xl border border-loss/25 bg-loss/[0.06] px-4 py-3">
            <p className="text-xs font-medium text-loss">
              This trade couldn&apos;t be logged — check the highlighted field{Object.keys(f.fieldErrors).length > 1 ? "s" : ""} above.
            </p>
          </div>
        )}
        {f.formError && (
          <div className="mt-6 rounded-2xl border border-loss/25 bg-loss/[0.06] px-4 py-3">
            <p className="text-xs text-loss">{f.formError}</p>
          </div>
        )}
      </Section>

      <div className="sticky bottom-0 z-10 border-t border-white/[0.08] bg-surface-solid/95 px-5 py-4 backdrop-blur-xl sm:px-7">
        <div className="flex items-center justify-between gap-4">
          <p className="hidden text-[11px] text-ink-muted sm:block">You can edit any detail later.</p>
          <div className="ml-auto flex items-center gap-2.5">
            <Button variant="ghost" size="sm" onClick={f.requestClose}>
              Cancel
            </Button>
            <Button size="md" onClick={f.handleSubmit} disabled={f.saving} className="min-w-28">
              {f.saving ? "Saving…" : isEditing ? "Save changes" : "Add trade"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
