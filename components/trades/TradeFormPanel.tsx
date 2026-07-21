"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchDropdownItems, DropdownItem } from "@/lib/dropdownSettings";
import { createTrade, updateTrade, Trade, TradeInput, Direction } from "@/lib/trades";
import { calculatePnl, calculateRMultiple } from "@/lib/metrics";

const emptyForm = {
  entry_date: new Date().toISOString().slice(0, 10),
  instrument: "",
  asset_class: "",
  strategy: "",
  session: "",
  emotion: "",
  direction: "long" as Direction,
  entry_price: "",
  exit_price: "",
  stop_loss_price: "",
  size: "",
  pnl: "",
  r_multiple: "",
  rules_followed: null as boolean | null,
  notes: "",
  tags: [] as string[],
};

type FormState = typeof emptyForm;

// Human-readable labels for validation messages.
const FIELD_LABELS: Record<string, string> = {
  entry_date: "Date",
  instrument: "Instrument",
  entry_price: "Entry price",
  exit_price: "Exit price",
  size: "Size",
  pnl: "P&L (or fill in entry price, exit price, and size so it can be calculated)",
};

function tradeToForm(trade: Trade): FormState {
  return {
    entry_date: trade.entry_date,
    instrument: trade.instrument,
    asset_class: trade.asset_class ?? "",
    strategy: trade.strategy ?? "",
    session: trade.session ?? "",
    emotion: trade.emotion ?? "",
    direction: (trade.direction ?? "long") as Direction,
    entry_price: trade.entry_price?.toString() ?? "",
    exit_price: trade.exit_price?.toString() ?? "",
    stop_loss_price: trade.stop_loss_price?.toString() ?? "",
    size: trade.size?.toString() ?? "",
    pnl: trade.pnl?.toString() ?? "",
    r_multiple: trade.r_multiple?.toString() ?? "",
    rules_followed: trade.rules_followed,
    notes: trade.notes ?? "",
    tags: trade.tags ?? [],
  };
}

export default function TradeFormPanel({
  trade,
  onClose,
  onSaved,
}: {
  trade: Trade | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { selectedAccount } = useAccount();
  const [form, setForm] = useState<FormState>(trade ? tradeToForm(trade) : emptyForm);
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Whether the P&L / R-multiple fields should keep tracking the
  // auto-calculation, or have been taken over by manual entry.
  // Starts in manual mode when editing an existing trade whose stored
  // value doesn't match what auto-calc would produce (so we never
  // silently overwrite a deliberate manual figure).
  const [pnlAuto, setPnlAuto] = useState(true);
  const [rAuto, setRAuto] = useState(true);

  useEffect(() => {
    if (!selectedAccount) return;
    fetchDropdownItems(selectedAccount.id).then(({ data }) => {
      if (data) setDropdowns(data as DropdownItem[]);
    });
  }, [selectedAccount?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!trade) return;
    const autoPnl = calculatePnl(
      trade.direction,
      trade.entry_price,
      trade.exit_price,
      trade.size
    );
    const autoR = calculateRMultiple(
      trade.direction,
      trade.entry_price,
      trade.exit_price,
      trade.stop_loss_price
    );
    setPnlAuto(autoPnl != null && trade.pnl === autoPnl);
    setRAuto(autoR != null && trade.r_multiple === autoR);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trade?.id]);

  const optionsFor = (category: string) =>
    dropdowns
      .filter((d) => d.category === category)
      .sort((a, b) => a.sort_order - b.sort_order);

  const tagOptions = optionsFor("tag");

  const entryNum = form.entry_price ? parseFloat(form.entry_price) : null;
  const exitNum = form.exit_price ? parseFloat(form.exit_price) : null;
  const stopNum = form.stop_loss_price ? parseFloat(form.stop_loss_price) : null;
  const sizeNum = form.size ? parseFloat(form.size) : null;

  const computedPnl = useMemo(
    () => calculatePnl(form.direction, entryNum, exitNum, sizeNum),
    [form.direction, entryNum, exitNum, sizeNum]
  );
  const computedR = useMemo(
    () => calculateRMultiple(form.direction, entryNum, exitNum, stopNum),
    [form.direction, entryNum, exitNum, stopNum]
  );

  // Keep the P&L / R-multiple text fields in sync while in auto mode.
  useEffect(() => {
    if (pnlAuto && computedPnl != null) {
      setForm((f) => ({ ...f, pnl: computedPnl.toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedPnl, pnlAuto]);

  useEffect(() => {
    if (rAuto && computedR != null) {
      setForm((f) => ({ ...f, r_multiple: computedR.toFixed(2) }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [computedR, rAuto]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function toggleTag(value: string) {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(value) ? f.tags.filter((t) => t !== value) : [...f.tags, value],
    }));
  }

  function handlePnlChange(value: string) {
    setPnlAuto(false);
    set("pnl", value);
  }

  function handleRChange(value: string) {
    setRAuto(false);
    set("r_multiple", value);
  }

  function resetPnlToAuto() {
    setPnlAuto(true);
    if (computedPnl != null) set("pnl", computedPnl.toFixed(2));
  }

  function resetRToAuto() {
    setRAuto(true);
    if (computedR != null) set("r_multiple", computedR.toFixed(2));
  }

  function validate(): string[] {
    const missing: string[] = [];
    if (!form.entry_date) missing.push(FIELD_LABELS.entry_date);
    if (!form.instrument.trim()) missing.push(FIELD_LABELS.instrument);

    // P&L is the one figure every trade needs. It's fine if it comes from
    // manual entry OR from entry price + exit price + size — but it can't
    // be missing entirely.
    const hasManualPnl = form.pnl.trim() !== "" && !Number.isNaN(parseFloat(form.pnl));
    const hasAutoPnlInputs = entryNum != null && exitNum != null && sizeNum != null;
    if (!hasManualPnl && !hasAutoPnlInputs) {
      missing.push(FIELD_LABELS.pnl);
    }

    return missing;
  }

  async function handleSubmit() {
    if (!selectedAccount) return;

    const missing = validate();
    if (missing.length > 0) {
      setErrors(missing);
      return;
    }
    setErrors([]);
    setSaving(true);

    const finalPnl = form.pnl.trim() !== "" ? parseFloat(form.pnl) : computedPnl ?? 0;
    const finalR = form.r_multiple.trim() !== "" ? parseFloat(form.r_multiple) : computedR;

    const input: TradeInput = {
      entry_date: form.entry_date,
      instrument: form.instrument.trim(),
      asset_class: form.asset_class || null,
      strategy: form.strategy || null,
      session: form.session || null,
      emotion: form.emotion || null,
      direction: form.direction || null,
      entry_price: entryNum,
      exit_price: exitNum,
      stop_loss_price: stopNum,
      size: sizeNum,
      pnl: finalPnl,
      r_multiple: finalR,
      rules_followed: form.rules_followed,
      notes: form.notes.trim() || null,
      tags: form.tags,
    };

    const { error: dbError } = trade
      ? await updateTrade(trade.id, input)
      : await createTrade(selectedAccount.id, input);

    setSaving(false);
    if (dbError) {
      setErrors(["Something went wrong saving this trade. Please try again."]);
      return;
    }
    onSaved();
  }

  const selectClass =
    "mt-1 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-sm";
  const labelClass = "text-xs text-ink-secondary";

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg h-full bg-surface-1 border-l border-surface-border overflow-y-auto">
        <div className="sticky top-0 bg-surface-1/95 backdrop-blur border-b border-surface-border px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="signal-bar h-6" />
            <h2 className="font-display text-lg font-medium">
              {trade ? "Edit trade" : "New trade"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-ink-muted hover:text-ink-primary text-sm px-2 py-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelClass}>Date</span>
              <input
                type="date"
                value={form.entry_date}
                onChange={(e) => set("entry_date", e.target.value)}
                className={`${selectClass} font-mono`}
              />
            </label>
            <label className="block">
              <span className={labelClass}>Instrument</span>
              <input
                value={form.instrument}
                onChange={(e) => set("instrument", e.target.value)}
                placeholder="e.g. EUR/USD"
                className={selectClass}
              />
            </label>
          </div>

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
                        ? "bg-brass text-surface-0 font-medium"
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
              <select
                value={form.asset_class}
                onChange={(e) => set("asset_class", e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>
                {optionsFor("asset_class").map((o) => (
                  <option key={o.id} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className={labelClass}>Strategy</span>
              <select
                value={form.strategy}
                onChange={(e) => set("strategy", e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>
                {optionsFor("strategy").map((o) => (
                  <option key={o.id} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={labelClass}>Session</span>
              <select
                value={form.session}
                onChange={(e) => set("session", e.target.value)}
                className={selectClass}
              >
                <option value="">—</option>
                {optionsFor("session").map((o) => (
                  <option key={o.id} value={o.value}>
                    {o.value}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className={labelClass}>Emotion</span>
            <select
              value={form.emotion}
              onChange={(e) => set("emotion", e.target.value)}
              className={selectClass}
            >
              <option value="">—</option>
              {optionsFor("emotion").map((o) => (
                <option key={o.id} value={o.value}>
                  {o.value}
                </option>
              ))}
            </select>
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
                type="number"
                step="any"
                value={form.size}
                onChange={(e) => set("size", e.target.value)}
                className={`${selectClass} font-mono`}
              />
            </label>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <div className="flex items-center justify-between">
                <span className={labelClass}>P&amp;L ({selectedAccount?.currency ?? "USD"})</span>
                {!pnlAuto && computedPnl != null && (
                  <button
                    type="button"
                    onClick={resetPnlToAuto}
                    className="text-[11px] text-brass hover:underline"
                  >
                    Use calculated
                  </button>
                )}
              </div>
              <input
                type="number"
                step="any"
                value={form.pnl}
                onChange={(e) => handlePnlChange(e.target.value)}
                className={`${selectClass} font-mono`}
              />
              {pnlAuto && computedPnl != null && (
                <span className="text-[11px] text-ink-muted">
                  Auto-calculated from entry, exit &amp; size
                </span>
              )}
            </label>
            <label className="block">
              <div className="flex items-center justify-between">
                <span className={labelClass}>R-multiple</span>
                {!rAuto && computedR != null && (
                  <button
                    type="button"
                    onClick={resetRToAuto}
                    className="text-[11px] text-brass hover:underline"
                  >
                    Use calculated
                  </button>
                )}
              </div>
              <input
                type="number"
                step="any"
                value={form.r_multiple}
                onChange={(e) => handleRChange(e.target.value)}
                className={`${selectClass} font-mono`}
              />
              {rAuto && computedR != null && (
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
                      ? "bg-brass text-surface-0 font-medium"
                      : "text-ink-secondary hover:text-ink-primary"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </label>

          {tagOptions.length > 0 && (
            <label className="block">
              <span className={labelClass}>Tags</span>
              <div className="mt-1 flex flex-wrap gap-2">
                {tagOptions.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => toggleTag(o.value)}
                    className={`px-3 py-1 rounded-full text-xs border transition-colors ${
                      form.tags.includes(o.value)
                        ? "bg-brass/15 border-brass text-brass"
                        : "border-surface-border text-ink-secondary hover:text-ink-primary"
                    }`}
                  >
                    {o.value}
                  </button>
                ))}
              </div>
            </label>
          )}

          <label className="block">
            <span className={labelClass}>Notes</span>
            <textarea
              value={form.notes}
              onChange={(e) => set("notes", e.target.value)}
              rows={3}
              className={selectClass}
            />
          </label>

          {errors.length > 0 && (
            <div className="rounded-md border border-loss/30 bg-loss/10 px-4 py-3">
              <p className="text-xs font-medium text-loss mb-1">
                This trade couldn&apos;t be logged. Please fill in:
              </p>
              <ul className="text-xs text-loss list-disc list-inside space-y-0.5">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="text-sm bg-brass text-surface-0 font-medium px-4 py-1.5 rounded-full disabled:opacity-60"
            >
              {saving ? "Saving…" : trade ? "Save changes" : "Add trade"}
            </button>
            <button
              onClick={onClose}
              className="text-sm text-ink-secondary hover:text-ink-primary px-4 py-1.5"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
