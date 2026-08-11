import { useEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "@/lib/AccountContext";
import { fetchDropdownItems, DropdownItem } from "@/lib/dropdownSettings";
import { fetchDistinctTags } from "@/lib/tagSettings";
import { createTrade, updateTrade, Trade, TradeInput, Direction, ExitReason, StopMovement } from "@/lib/trades";
import { calculatePnl, calculateRMultiple } from "@/lib/metrics";
import { localDateString } from "@/lib/date";
import { uploadScreenshot, deleteScreenshot, validateScreenshotFile } from "@/lib/screenshots";
import type { SelectOption } from "@/components/shared/Select";

const emptyForm = {
  entry_date: localDateString(),
  entry_time: "",
  exit_date: "",
  exit_time: "",
  instrument: "",
  asset_class: "",
  strategy: "",
  session: "",
  emotion: "",
  direction: "long" as Direction,
  entry_price: "",
  exit_price: "",
  stop_loss_price: "",
  take_profit_price: "",
  size: "",
  pnl: "",
  r_multiple: "",
  rules_followed: null as boolean | null,
  exit_reason: "" as ExitReason | "",
  sl_movement: null as StopMovement | null,
  tp_movement: null as StopMovement | null,
  notes: "",
  tags: [] as string[],
};

export type FormState = typeof emptyForm;

// A small absolute tolerance for comparing a stored figure against a
// freshly-recomputed one. Floating point arithmetic on prices (e.g.
// 1.105 - 1.1 in JS) essentially never lands on the exact same bit
// pattern twice, so a strict equality check would treat almost every
// genuinely auto-calculated trade as "manually overridden."
const CALC_MATCH_TOLERANCE = 0.005;

function matchesCalc(stored: number | null, calculated: number | null): boolean {
  if (stored == null || calculated == null) return false;
  return Math.abs(stored - calculated) < CALC_MATCH_TOLERANCE;
}

// Whether the P&L / R-multiple fields should start in auto mode: always
// true for a brand new trade, or for an existing one whose stored value
// matches what entry/exit/size (or entry/exit/stop) imply. This has to be
// computed synchronously, as part of the initial state, rather than in a
// useEffect that runs after mount — otherwise the very first render briefly
// sees the default "auto" state and the sync effect below overwrites a
// genuinely manual figure (e.g. a real fee-adjusted P&L) with the raw
// auto-calculated one before this check has had a chance to correct it.
function initialPnlAuto(trade: Trade | null): boolean {
  if (!trade) return true;
  const autoPnl = calculatePnl(trade.direction, trade.entry_price, trade.exit_price, trade.size);
  return matchesCalc(trade.pnl, autoPnl);
}

function initialRAuto(trade: Trade | null): boolean {
  if (!trade) return true;
  const autoR = calculateRMultiple(
    trade.direction,
    trade.entry_price,
    trade.exit_price,
    trade.stop_loss_price
  );
  return matchesCalc(trade.r_multiple, autoR);
}

// Rounds off binary floating-point noise (e.g. 129.99999999999997 from
// (110-100)*13) without collapsing genuine sub-cent precision to zero.
// The P&L field previously used toFixed(2) here, which is a *display*
// rounding rule — applying it before the value is ever saved meant a real
// P&L of $0.004 was stored as exactly $0.00, indistinguishable from an
// actual breakeven trade everywhere else in the app (win rate, streaks,
// color coding). Components that display P&L already round to 2 decimals
// on their own for presentation; this only removes noise past the 8th
// decimal, well beyond what any real trade needs.
function roundForStorage(value: number): number {
  return Math.round(value * 1e8) / 1e8;
}

// Human-readable labels for validation messages.
const FIELD_LABELS: Record<string, string> = {
  entry_date: "Entry date",
  instrument: "Instrument",
  entry_price: "Entry price",
  exit_price: "Exit price",
  size: "Size",
  pnl: "P&L (or fill in entry price, exit price, and size so it can be calculated)",
};

// Keys validate() can attach an error to. "size" covers the
// greater-than-0 check; a missing/invalid P&L is reported on "pnl" even
// though it can be satisfied indirectly via entry/exit/size, since that's
// the field the user actually sees the message next to.
export type TradeFormFieldKey = "entry_date" | "instrument" | "size" | "pnl";

export const EXIT_REASON_OPTIONS: { value: ExitReason; label: string }[] = [
  { value: "stop_loss", label: "Stop loss hit" },
  { value: "take_profit", label: "Take profit hit" },
  { value: "manual", label: "Manual close" },
  { value: "other", label: "Other" },
];

export const MOVEMENT_OPTIONS: { value: StopMovement; label: string }[] = [
  { value: "held", label: "Held" },
  { value: "tightened", label: "Tightened" },
  { value: "widened", label: "Widened" },
];

function tradeToForm(trade: Trade): FormState {
  return {
    entry_date: trade.entry_date,
    // Trades saved before this field existed (or ones without a time
    // entered) come back as null — an empty string leaves the <input
    // type="time"> blank rather than showing a placeholder "00:00".
    entry_time: trade.entry_time?.slice(0, 5) ?? "",
    // Same null-vs-empty-string handling as entry_date/entry_time — a
    // trade with no exit logged yet leaves these blank rather than showing
    // a placeholder date/time.
    exit_date: trade.exit_date ?? "",
    exit_time: trade.exit_time?.slice(0, 5) ?? "",
    instrument: trade.instrument,
    asset_class: trade.asset_class ?? "",
    strategy: trade.strategy ?? "",
    session: trade.session ?? "",
    emotion: trade.emotion ?? "",
    direction: (trade.direction ?? "long") as Direction,
    entry_price: trade.entry_price?.toString() ?? "",
    exit_price: trade.exit_price?.toString() ?? "",
    stop_loss_price: trade.stop_loss_price?.toString() ?? "",
    take_profit_price: trade.take_profit_price?.toString() ?? "",
    size: trade.size?.toString() ?? "",
    pnl: trade.pnl?.toString() ?? "",
    r_multiple: trade.r_multiple?.toString() ?? "",
    rules_followed: trade.rules_followed,
    exit_reason: trade.exit_reason ?? "",
    sl_movement: trade.sl_movement,
    tp_movement: trade.tp_movement,
    notes: trade.notes ?? "",
    tags: trade.tags ?? [],
  };
}

export type UseTradeFormArgs = {
  trade: Trade | null;
  duplicateFrom?: Trade | null;
  onClose: () => void;
  // Receives the server's authoritative row for the trade that was just
  // created or updated, so the caller can patch its local cache directly
  // instead of re-fetching the whole trade list — see
  // TradesDataContext's docstring.
  onSaved: (savedTrade: Trade) => void;
  onOpenDiary?: (trade: Trade) => void;
};

/**
 * All state, derived values, and handlers behind TradeFormPanel: form
 * fields, dirty-tracking, the discard-confirm flow (Escape / back-button /
 * beforeunload), dropdown + tag-suggestion fetching, auto-calculated P&L /
 * R-multiple, screenshot staging, validation, and save. Split out of
 * TradeFormPanel (formerly a single 1000+ line component) so the panel
 * itself only has to wire this up to markup — see trade-journal-webapp
 * memory, "TradeFormPanel split" for why.
 */
export function useTradeForm({ trade, duplicateFrom, onClose, onSaved, onOpenDiary }: UseTradeFormArgs) {
  const { selectedAccount } = useAccount();
  const [form, setForm] = useState<FormState>(() => {
    if (trade) return tradeToForm(trade);
    if (duplicateFrom) {
      return { ...tradeToForm(duplicateFrom), entry_date: localDateString(), exit_date: "", exit_time: "" };
    }
    return emptyForm;
  });
  // Snapshot of the form exactly as it was when the panel opened. Compared
  // against the live form to decide whether closing needs a confirmation —
  // this can't drift out of sync the way a hand-maintained "dirty" flag
  // could as fields get added later.
  const initialFormRef = useRef(form);
  // Drives the custom ConfirmDialog (replaces window.confirm — see below).
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  // Which action the discard-confirm dialog is guarding — closing the
  // panel outright, or (see requestOpenDiary below) jumping to the Diary
  // button's destination instead. Same dialog, different follow-through on
  // confirm, so the wording matches whichever one the user actually
  // triggered rather than always saying "Discard changes?" for both.
  const [pendingAction, setPendingAction] = useState<"close" | "diary">("close");
  const pendingDiaryTradeRef = useRef<Trade | null>(null);
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);
  const [tagSuggestions, setTagSuggestions] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Field-level errors, keyed so TradeFormFields can render each message
  // right under the input it describes (red border + inline text) instead
  // of a single generic list the user has to match back to a field by
  // memory. formError carries anything that isn't about one specific
  // field (a failed screenshot upload, a save request that errored) and
  // still renders as the old top-of-form banner.
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<TradeFormFieldKey, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  // One ref per validatable field, so a failed submit can scroll to and
  // focus the first invalid one instead of leaving the user to hunt for
  // it — the field list order here doubles as the "first error wins"
  // priority order.
  const fieldRefs = useRef<Partial<Record<TradeFormFieldKey, HTMLElement | null>>>({});
  function registerFieldRef(key: TradeFormFieldKey) {
    return (el: HTMLElement | null) => {
      fieldRefs.current[key] = el;
    };
  }

  // Whether the P&L / R-multiple fields should keep tracking the
  // auto-calculation, or have been taken over by manual entry.
  // Starts in manual mode when editing an existing trade whose stored
  // value doesn't match what auto-calc would produce (so we never
  // silently overwrite a deliberate manual figure) — see initialPnlAuto.
  const [pnlAuto, setPnlAuto] = useState(() => initialPnlAuto(trade ?? duplicateFrom ?? null));
  const [rAuto, setRAuto] = useState(() => initialRAuto(trade ?? duplicateFrom ?? null));

  // Chart screenshot: file staged for upload, current preview (existing
  // trade's screenshot_url or a local object URL for a newly-picked file),
  // and whether the user explicitly cleared an existing screenshot.
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(
    trade?.screenshot_url ?? null
  );
  const [screenshotRemoved, setScreenshotRemoved] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Whether anything has actually changed since the panel opened. A
  // straight comparison against the open-time snapshot rather than a
  // hand-maintained "dirty" flag on each field, so it can't silently stop
  // covering a field added later.
  function hasUnsavedChanges() {
    return (
      JSON.stringify(form) !== JSON.stringify(initialFormRef.current) ||
      screenshotFile !== null ||
      screenshotRemoved
    );
  }

  // Every close trigger (X, Cancel, overlay click, Escape) routes through
  // this — no confirmation needed if nothing changed, otherwise the styled
  // ConfirmDialog opens and the actual close happens from its buttons.
  function requestClose() {
    if (saving) return;
    if (!hasUnsavedChanges()) {
      onClose();
      return;
    }
    setPendingAction("close");
    setShowDiscardConfirm(true);
  }

  // Same guard as requestClose, for the "Diary" button — jumping to the
  // note discards in-progress trade edits exactly the same way closing the
  // panel would, so it goes through the same styled ConfirmDialog (not a
  // separate window.confirm) rather than a second, differently-worded
  // native popup for what's really the same kind of decision.
  function requestOpenDiary(t: Trade) {
    if (saving || !onOpenDiary) return;
    if (!hasUnsavedChanges()) {
      onOpenDiary(t);
      return;
    }
    pendingDiaryTradeRef.current = t;
    setPendingAction("diary");
    setShowDiscardConfirm(true);
  }

  // The Escape-key and browser-back-button handlers below are set up once,
  // in effects with empty dependency arrays (so a keystroke doesn't tear
  // down and re-attach a window-level listener on every render) — so they
  // reach *current* state through these refs instead of closing over a
  // single, stale render.
  const hasUnsavedChangesRef = useRef(hasUnsavedChanges);
  const requestCloseRef = useRef(requestClose);
  const showDiscardConfirmRef = useRef(showDiscardConfirm);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
    requestCloseRef.current = requestClose;
    showDiscardConfirmRef.current = showDiscardConfirm;
    onCloseRef.current = onClose;
  });

  // Keyed on the id, not the object — same reasoning as the notes-fetch
  // effect in app/notes/page.tsx (spurious object-identity churn from
  // AccountContext shouldn't re-trigger this fetch).
  useEffect(() => {
    if (!selectedAccount) return;
    fetchDropdownItems(selectedAccount.id).then(({ data }) => {
      if (data) setDropdowns(data as DropdownItem[]);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  // Freeform tag suggestion fix, part 1: suggest every tag actually in use
  // on this account (trades + notes), not just the curated tag_settings
  // list — see fetchDistinctTags for why. Part 2 retired the tag_settings
  // fetch that used to live here — that table is no longer a curated
  // suggestion source (see components/settings/TagSettingCard.tsx).
  // Keyed on the id, not the object — same object-identity-churn reasoning
  // as the effect above.
  useEffect(() => {
    if (!selectedAccount) return;
    fetchDistinctTags(selectedAccount.id).then(setTagSuggestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAccount?.id]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      if (showDiscardConfirmRef.current) {
        // A second Escape while the confirm dialog is already open backs
        // out of *that*, returning to the form — it shouldn't be treated
        // as yet another close attempt.
        setShowDiscardConfirm(false);
      } else {
        requestCloseRef.current();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Make the browser/hardware back button close this panel instead of
  // navigating away from the Trades page underneath it. We push a
  // placeholder history entry when the panel opens; a back-button press
  // pops it and fires popstate.
  //
  // When there are no unsaved changes, that's simply treated as "close".
  // When there ARE unsaved changes, we can't wait for an async confirmation
  // before deciding whether to let the navigation through — by the time the
  // user answers, the back button has already fired — so instead we
  // immediately re-push the placeholder (undoing the navigation right away,
  // every time) and only *then* show the confirm dialog. If the user
  // confirms, closing proceeds exactly like every other close path (Cancel,
  // X, overlay, Escape): the placeholder we just re-pushed gets popped once
  // by the ordinary unmount cleanup below. This doesn't depend on
  // window.confirm's synchronous blocking behavior, which is what made the
  // previous version of this fragile on mobile back-gesture handling.
  useEffect(() => {
    const stateId = Math.random().toString(36).slice(2);
    window.history.pushState({ tradeFormPanel: stateId }, "");
    let closedByPopState = false;

    function handlePopState() {
      if (!hasUnsavedChangesRef.current()) {
        closedByPopState = true;
        onCloseRef.current();
        return;
      }
      window.history.pushState({ tradeFormPanel: stateId }, "");
      setPendingAction("close");
      setShowDiscardConfirm(true);
    }
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!closedByPopState && window.history.state?.tradeFormPanel === stateId) {
        window.history.back();
      }
    };
  }, []);

  // Warn on closing the browser tab / refreshing too, not just in-app
  // navigation — the same accidental-loss risk, just via a different exit.
  // Browsers ignore any custom message here and show their own fixed,
  // native-looking text — there's no way to swap this one for our own
  // styled dialog, unlike every in-app close path above.
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!saving && hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  });

  const optionsFor = (category: string) =>
    dropdowns
      .filter((d) => d.category === category)
      .sort((a, b) => a.sort_order - b.sort_order);

  // If a trade's stored value was later removed from Settings, it won't be
  // in optionsFor(...) anymore. Rather than have the select silently show
  // blank (which risks the field getting cleared on save if the user
  // doesn't notice and re-saves), keep it as a selectable option — just
  // marked (muted) so it's clear it's no longer an active list item.
  function renderOptions(category: string, currentValue: string): SelectOption[] {
    const active = optionsFor(category);
    const isOrphaned = currentValue !== "" && !active.some((o) => o.value === currentValue);
    return [
      { value: "", label: "—" },
      ...active.map((o) => ({ value: o.value, label: o.value })),
      ...(isOrphaned ? [{ value: currentValue, label: `${currentValue} (removed from list)`, muted: true }] : []),
    ];
  }

  const entryNum = form.entry_price ? parseFloat(form.entry_price) : null;
  const exitNum = form.exit_price ? parseFloat(form.exit_price) : null;
  const stopNum = form.stop_loss_price ? parseFloat(form.stop_loss_price) : null;
  const tpNum = form.take_profit_price ? parseFloat(form.take_profit_price) : null;
  const sizeNum = form.size ? parseFloat(form.size) : null;

  const computedPnl = useMemo(
    () => calculatePnl(form.direction, entryNum, exitNum, sizeNum),
    [form.direction, entryNum, exitNum, sizeNum]
  );
  const computedR = useMemo(
    () => calculateRMultiple(form.direction, entryNum, exitNum, stopNum),
    [form.direction, entryNum, exitNum, stopNum]
  );

  // Non-blocking sanity check: when P&L has been manually overridden and
  // entry/exit/size are all present, flag it if the manual figure doesn't
  // match what those inputs imply. This never blocks saving — fees,
  // slippage, and partial fills are all legitimate reasons the numbers
  // won't line up exactly. It just makes sure the mismatch isn't silent.
  const pnlMismatch = useMemo(() => {
    if (pnlAuto || computedPnl == null) return null;
    const manual = parseFloat(form.pnl);
    if (Number.isNaN(manual)) return null;
    const diff = Math.abs(manual - computedPnl);
    if (diff < CALC_MATCH_TOLERANCE) return null;
    return { computed: computedPnl, manual, diff };
  }, [pnlAuto, computedPnl, form.pnl]);

  // Keep the P&L / R-multiple text fields in sync while in auto mode.
  useEffect(() => {
    if (pnlAuto && computedPnl != null) {
      // Syncs the P&L text field from the computed value while in auto
      // mode — a derived-state sync, not driven by an external system,
      // but keeping it here (rather than at each of computedPnl's own
      // dependency sites) avoids duplicating the auto-mode gating logic.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, pnl: String(roundForStorage(computedPnl)) }));
    }
  }, [computedPnl, pnlAuto]);

  useEffect(() => {
    if (rAuto && computedR != null) {
      // Same as the P&L sync above, for the R-multiple field.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setForm((f) => ({ ...f, r_multiple: String(roundForStorage(computedR)) }));
    }
  }, [computedR, rAuto]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
    // Clear that field's red border/message as soon as the user edits it,
    // rather than leaving it lit until the next submit attempt re-runs
    // validate() — the user has already acted on the message.
    if (key in fieldErrors) {
      setFieldErrors((e) => {
        const rest = { ...e };
        delete rest[key as unknown as TradeFormFieldKey];
        return rest;
      });
    }
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
    if (computedPnl != null) set("pnl", String(roundForStorage(computedPnl)));
  }

  function resetRToAuto() {
    setRAuto(true);
    if (computedR != null) set("r_multiple", String(roundForStorage(computedR)));
  }

  function handleScreenshotSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    const invalid = validateScreenshotFile(file);
    if (invalid) {
      setScreenshotError(invalid);
      return;
    }

    setScreenshotError(null);
    setScreenshotRemoved(false);
    setScreenshotFile(file);
    setScreenshotPreview(URL.createObjectURL(file));
  }

  function handleRemoveScreenshot() {
    setScreenshotFile(null);
    setScreenshotPreview(null);
    setScreenshotRemoved(true);
    setScreenshotError(null);
  }

  function validate(): Partial<Record<TradeFormFieldKey, string>> {
    const missing: Partial<Record<TradeFormFieldKey, string>> = {};
    if (!form.entry_date) missing.entry_date = `${FIELD_LABELS.entry_date} is required.`;
    if (!form.instrument.trim()) missing.instrument = `${FIELD_LABELS.instrument} is required.`;

    if (sizeNum != null && sizeNum <= 0) {
      missing.size = "Size must be greater than 0.";
    }

    // P&L is the one figure every trade needs. It's fine if it comes from
    // manual entry OR from entry price + exit price + size — but it can't
    // be missing entirely.
    const hasManualPnl = form.pnl.trim() !== "" && !Number.isNaN(parseFloat(form.pnl));
    const hasAutoPnlInputs = entryNum != null && exitNum != null && sizeNum != null;
    if (!hasManualPnl && !hasAutoPnlInputs) {
      missing.pnl = `${FIELD_LABELS.pnl}.`;
    }

    return missing;
  }

  // Order fields are checked in when deciding which one gets focus — top
  // of the form first, matching the order a user would naturally tab
  // through it.
  const FIELD_FOCUS_ORDER: TradeFormFieldKey[] = ["entry_date", "instrument", "size", "pnl"];

  function focusFirstError(missing: Partial<Record<TradeFormFieldKey, string>>) {
    const firstKey = FIELD_FOCUS_ORDER.find((k) => missing[k]);
    if (!firstKey) return;
    const el = fieldRefs.current[firstKey];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.focus();
  }

  async function handleSubmit() {
    if (!selectedAccount) return;

    const missing = validate();
    if (Object.keys(missing).length > 0) {
      setFieldErrors(missing);
      setFormError(null);
      focusFirstError(missing);
      return;
    }
    setFieldErrors({});
    setFormError(null);
    setSaving(true);

    // Resolve the screenshot first so a failed upload doesn't leave the
    // trade half-saved: keep the existing URL by default, replace it if a
    // new file was picked, or clear it if the user removed it.
    let finalScreenshotUrl: string | null = trade?.screenshot_url ?? null;
    let finalScreenshotFileId: string | null = trade?.screenshot_file_id ?? null;
    if (screenshotFile) {
      setUploadingScreenshot(true);
      const { url, fileId, error: uploadError } = await uploadScreenshot(selectedAccount.id, screenshotFile);
      setUploadingScreenshot(false);
      if (uploadError || !url) {
        setSaving(false);
        setFormError(uploadError || "Screenshot upload failed. Please try again.");
        return;
      }
      finalScreenshotUrl = url;
      finalScreenshotFileId = fileId;
    } else if (screenshotRemoved) {
      finalScreenshotUrl = null;
      finalScreenshotFileId = null;
    }

    const finalPnl = form.pnl.trim() !== "" ? parseFloat(form.pnl) : computedPnl ?? 0;
    const finalR = form.r_multiple.trim() !== "" ? parseFloat(form.r_multiple) : computedR;

    const input: TradeInput = {
      entry_date: form.entry_date,
      entry_time: form.entry_time || null,
      exit_date: form.exit_date || null,
      exit_time: form.exit_time || null,
      instrument: form.instrument.trim(),
      asset_class: form.asset_class || null,
      strategy: form.strategy || null,
      session: form.session || null,
      emotion: form.emotion || null,
      direction: form.direction || null,
      entry_price: entryNum,
      exit_price: exitNum,
      stop_loss_price: stopNum,
      take_profit_price: tpNum,
      size: sizeNum,
      pnl: finalPnl,
      r_multiple: finalR,
      rules_followed: form.rules_followed,
      exit_reason: (form.exit_reason || null) as ExitReason | null,
      sl_movement: form.sl_movement,
      tp_movement: form.tp_movement,
      notes: form.notes.trim() || null,
      screenshot_url: finalScreenshotUrl,
      screenshot_file_id: finalScreenshotFileId,
      tags: form.tags,
      broker_ticket: trade?.broker_ticket ?? null,
    };

    const { data: savedTrade, error: dbError } = trade
      ? await updateTrade(trade.id, input)
      : await createTrade(selectedAccount.id, input);

    setSaving(false);
    if (dbError || !savedTrade) {
      setFormError("Something went wrong saving this trade. Please try again.");
      return;
    }

    // Now that the trade row points at the new screenshot (or none), it's
    // safe to remove whatever it used to point at.
    const previousUrl = trade?.screenshot_url ?? null;
    const previousFileId = trade?.screenshot_file_id ?? null;
    if (previousUrl && previousUrl !== finalScreenshotUrl) {
      deleteScreenshot({ url: previousUrl, fileId: previousFileId }).catch(() => {});
    }

    onSaved(savedTrade as Trade);
  }

  return {
    selectedAccount,
    form,
    set,
    fieldErrors,
    formError,
    registerFieldRef,
    saving,

    // discard-confirm flow
    showDiscardConfirm,
    setShowDiscardConfirm,
    pendingAction,
    pendingDiaryTradeRef,
    requestClose,
    requestOpenDiary,

    // dropdowns / tags
    renderOptions,
    tagSuggestions,

    // P&L / R-multiple
    computedPnl,
    computedR,
    pnlAuto,
    rAuto,
    pnlMismatch,
    handlePnlChange,
    handleRChange,
    resetPnlToAuto,
    resetRToAuto,

    // screenshot
    fileInputRef,
    screenshotPreview,
    screenshotError,
    uploadingScreenshot,
    handleScreenshotSelect,
    handleRemoveScreenshot,

    // submit
    handleSubmit,
  };
}

export type UseTradeFormReturn = ReturnType<typeof useTradeForm>;
