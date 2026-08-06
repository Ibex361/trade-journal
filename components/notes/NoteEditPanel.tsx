"use client";

import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import Button from "@/components/shared/Button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
import { Select } from "@/components/shared/Select";
import NoteEditor from "@/components/notes/NoteEditor";
import NoteEditorErrorBoundary from "@/components/notes/NoteEditorErrorBoundary";
import LinkedTradesPicker from "@/components/notes/LinkedTradesPicker";
import { useAccount } from "@/lib/AccountContext";
import { fetchDropdownItems, type DropdownItem } from "@/lib/dropdownSettings";
import type { Note } from "@/lib/notes";
import type { Trade } from "@/lib/trades";

/**
 * Phase 1c part 2 adds Delete (with a ConfirmDialog, same component the
 * Trades page's delete flow uses) on top of part 1's open/edit/save.
 *
 * Phase 3 part 1 adds a tag picker — same chip-toggle UX as
 * TradeFormPanel's tag section, reusing the same account-wide "tag"
 * dropdown vocabulary (Settings → Tags) rather than a notes-only list, so
 * a tag means the same thing on a trade or a note. Fetches its own
 * dropdown items independently (TradeFormPanel does the same), rather than
 * threading them down from app/notes/page.tsx.
 *
 * Phase 3 part 3 adds optional linking: a "Linked strategy" select (same
 * `renderOptions`-style orphan handling TradeFormPanel uses for its own
 * strategy field, since a note can reference a strategy that's since been
 * removed from Settings) and a LinkedTradesPicker for linking one or more
 * trades. `trades` is threaded down from app/notes/page.tsx's
 * useTradesData() call rather than fetched here, since the full account
 * trade list is already cached there.
 *
 * Dirty tracking is intentionally simple (title/content/tags/links changed
 * since last save) rather than a full undo-aware diff — good enough to
 * decide whether "Close" should warn.
 *
 * Notes Phase 5 Part 1 (debounced autosave + status indicator): every field
 * change now also schedules an autosave a short pause after the last edit,
 * via the same onSave callback the manual Save button already used — so
 * both paths funnel through one runSave(). The Save button is kept as an
 * explicit "save right now" action (flushes the pending debounce) rather
 * than removed, since it's cheap to keep and some users will still reach
 * for it out of habit. A small status label (Saved / Unsaved changes /
 * Saving… / Save failed) replaces having to infer save state from whether
 * the Save button happens to be enabled.
 *
 * Notes Phase 5 Part 2 (confirm-dialog rewiring + save-retry): the
 * Close/jump-to-trade guards no longer ask "discard changes?" — with
 * autosave in place, "discard" rarely makes sense (there's nothing to
 * discard, just something not yet flushed). Both now flush any pending
 * save immediately instead (same runSave() the debounce/manual button use)
 * and proceed right away rather than blocking on it, since the parent's
 * save continues independently of this panel unmounting. If the previous
 * save attempt failed (saveStatus "error"), that also counts as reason to
 * flush before leaving — one more attempt beats silently walking away from
 * a failed save. The status label itself is now clickable when it reads
 * "Save failed", as a manual retry.
 */
const AUTOSAVE_DELAY_MS = 1500;

export default function NoteEditPanel({
  note,
  trades,
  saving,
  saveError,
  deleting,
  onSave,
  onDelete,
  onClose,
  onOpenTrade,
}: {
  note: Note;
  trades: Trade[];
  saving: boolean;
  // True if the most recent save attempt (manual or auto) failed. Reset by
  // the parent whenever a different note is opened.
  saveError: boolean;
  deleting: boolean;
  onSave: (title: string, content: JSONContent, tags: string[], linkedTradeIds: string[], linkedStrategy: string | null) => void;
  onDelete: () => void;
  onClose: () => void;
  // Jumps to a linked trade in the Trades page (via LinkedTradesPicker's
  // clickable chips) — see app/notes/page.tsx's handleOpenTrade.
  onOpenTrade?: (trade: Trade) => void;
}) {
  const { selectedAccount } = useAccount();
  const [title, setTitle] = useState(note.title);
  const [content, setContent] = useState<JSONContent | null>(note.content);
  const [tags, setTags] = useState<string[]>(note.tags ?? []);
  const [linkedTradeIds, setLinkedTradeIds] = useState<string[]>(note.linked_trade_ids ?? []);
  const [linkedStrategy, setLinkedStrategy] = useState<string>(note.linked_strategy ?? "");
  const [dropdowns, setDropdowns] = useState<DropdownItem[]>([]);
  const [dirty, setDirty] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Details (tags/linked strategy/linked trades) start collapsed so
  // opening a note goes straight into writing, like a real document
  // rather than a form. Auto-opens if the note already has any of that
  // metadata set, so existing links/tags aren't hidden by default.
  const [detailsOpen, setDetailsOpen] = useState(
    () => (note.tags?.length ?? 0) > 0 || Boolean(note.linked_strategy) || (note.linked_trade_ids?.length ?? 0) > 0
  );

  // Autosave machinery. Field values are mirrored into a ref (updated by
  // the effect just below, which runs well before the 1.5s debounce could
  // ever fire) so the debounced save always reads the latest values rather
  // than whatever was captured in the closure at the moment the timer was
  // scheduled — plain useState reads inside a setTimeout callback would
  // otherwise be stale by one keystroke.
  const fieldsRef = useRef({ title, content, tags, linkedTradeIds, linkedStrategy });
  useEffect(() => {
    fieldsRef.current = { title, content, tags, linkedTradeIds, linkedStrategy };
  }, [title, content, tags, linkedTradeIds, linkedStrategy]);

  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mirrors the `saving` prop into a ref for the same stale-closure reason
  // as fieldsRef above.
  const savingRef = useRef(saving);
  useEffect(() => {
    savingRef.current = saving;
  }, [saving]);
  // Set when the debounce elapses while a save is already in flight (e.g.
  // the manual Save button was clicked right as the timer was about to
  // fire) — rather than dropping that change, it's picked up as soon as
  // the in-flight save finishes.
  const pendingAutosaveRef = useRef(false);

  function buildSavePayload() {
    const f = fieldsRef.current;
    return {
      title: f.title.trim() || "Untitled",
      content: f.content ?? { type: "doc", content: [{ type: "paragraph" }] },
      tags: f.tags,
      linkedTradeIds: f.linkedTradeIds,
      linkedStrategy: f.linkedStrategy || null,
    };
  }

  function runSave() {
    const payload = buildSavePayload();
    onSave(payload.title, payload.content, payload.tags, payload.linkedTradeIds, payload.linkedStrategy);
    setDirty(false);
  }

  function scheduleAutosave() {
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      autosaveTimerRef.current = null;
      if (savingRef.current) {
        pendingAutosaveRef.current = true;
        return;
      }
      runSave();
    }, AUTOSAVE_DELAY_MS);
  }

  // Catches up on an autosave that was deferred above because a save was
  // already in flight when the debounce elapsed.
  useEffect(() => {
    if (!saving && pendingAutosaveRef.current) {
      pendingAutosaveRef.current = false;
      runSave();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [saving]);

  // Notes Phase 5 Part 3 (auto-retry on reconnect + offline-aware label):
  // a save that fails because the connection is down leaves saveError=true
  // and just sits there — nothing was listening for the network coming
  // back, so the only thing that ever retried was closing the panel
  // (handleClose flushes on dirty || saveError) or typing again (which
  // reschedules the debounce). If neither happened — network drops, comes
  // back, user isn't actively typing — the note stayed stuck on "Save
  // failed" until something else happened to call runSave(), which read
  // as "saving is broken unless I close and reopen the note". This
  // listens for the browser's `online` event directly and retries right
  // then, same runSave() the manual button and autosave already use.
  // Mirrors savingRef below it: reads saveError/saving from refs rather
  // than the effect's own closure, since `online` can fire at any point
  // and a plain useState read here would risk retrying with a stale
  // saveError value from whenever this effect last re-ran.
  //
  // isOffline is separate plain state (not a ref) since — unlike
  // saveErrorRef, only ever read inside a browser-event callback — this
  // one drives the rendered label directly further down, so it needs to
  // trigger a re-render when it changes. Initialized from
  // `navigator.onLine` directly rather than assuming `false`, so a note
  // opened while already offline shows the right label immediately
  // instead of waiting for an `offline` event that already fired before
  // this component mounted.
  const [isOffline, setIsOffline] = useState(
    () => typeof navigator !== "undefined" && !navigator.onLine
  );
  const saveErrorRef = useRef(saveError);
  useEffect(() => {
    saveErrorRef.current = saveError;
  }, [saveError]);
  useEffect(() => {
    function handleOnline() {
      setIsOffline(false);
      if (saveErrorRef.current && !savingRef.current) {
        runSave();
      }
    }
    function handleOffline() {
      setIsOffline(true);
    }
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This component is remounted per note (app/notes/page.tsx keys it by
  // note.id — see that file's comment), so "switching notes" means this
  // instance unmounts; clearing any pending timer here stops a debounced
  // save for note A from ever firing after note B is already open.
  useEffect(() => {
    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!selectedAccount) return;
    fetchDropdownItems(selectedAccount.id).then(({ data }) => {
      if (data) setDropdowns(data as DropdownItem[]);
    });
  }, [selectedAccount?.id]);

  const tagOptions = dropdowns
    .filter((d) => d.category === "tag")
    .sort((a, b) => a.sort_order - b.sort_order);
  // A tag on this note that's since been removed from Settings — kept
  // selectable (dashed style) rather than silently dropped, same treatment
  // TradeFormPanel gives orphaned tags.
  const orphanedTags = tags.filter((t) => !tagOptions.some((o) => o.value === t));

  const strategyOptions = dropdowns
    .filter((d) => d.category === "strategy")
    .sort((a, b) => a.sort_order - b.sort_order);
  // Same orphan treatment as tags above — a linked strategy that's since
  // been removed from Settings stays selected rather than silently
  // clearing, so saving the note again doesn't quietly drop it.
  const strategyIsOrphaned = linkedStrategy !== "" && !strategyOptions.some((o) => o.value === linkedStrategy);

  function handleTitleChange(value: string) {
    setTitle(value);
    setDirty(true);
    scheduleAutosave();
  }

  function handleContentChange(value: JSONContent) {
    setContent(value);
    setDirty(true);
    scheduleAutosave();
  }

  function toggleTag(value: string) {
    setTags((current) => (current.includes(value) ? current.filter((t) => t !== value) : [...current, value]));
    setDirty(true);
    scheduleAutosave();
  }

  function handleLinkedTradeIdsChange(ids: string[]) {
    setLinkedTradeIds(ids);
    setDirty(true);
    scheduleAutosave();
  }

  function handleLinkedStrategyChange(value: string) {
    setLinkedStrategy(value);
    setDirty(true);
    scheduleAutosave();
  }

  // Manual "Save" button: saves immediately rather than waiting out
  // whatever's left of the debounce.
  function handleSave() {
    if (autosaveTimerRef.current) {
      clearTimeout(autosaveTimerRef.current);
      autosaveTimerRef.current = null;
    }
    runSave();
  }

  function handleClose() {
    if (dirty || saveError) handleSave();
    onClose();
  }

  // Escape closes the panel the same way the Close button does (flush +
  // leave, no discard-confirm — see the class comment above for why this
  // panel doesn't need TradeFormPanel's separate confirm-dialog gating on
  // its Escape handler). Set up once with an empty dependency array so a
  // keystroke doesn't tear down/re-attach a window-level listener on every
  // render; a ref keeps it reaching the *current* handleClose instead of
  // closing over a stale one from the render it was attached in.
  const handleCloseRef = useRef(handleClose);
  handleCloseRef.current = handleClose;
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") handleCloseRef.current();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Same flush-before-leaving behavior as handleClose, for jumping to a
  // linked trade.
  function handleOpenTrade(t: Trade) {
    if (dirty || saveError) handleSave();
    onOpenTrade?.(t);
  }

  // "offline" is its own status, not folded into "error": a real save
  // failure (bad request, server error, etc.) is something tapping
  // "retry" can act on immediately, but a save failing purely because
  // navigator.onLine is false has nothing to retry until the browser
  // itself says the connection is back — the retry-on-`online` effect
  // above already handles that automatically, so this state is
  // informational only (not the clickable/underlined treatment "error"
  // gets). Only shown when isOffline AND there's actually a save to
  // report on (saveError, or dirty/saving) — otherwise a note with
  // nothing unsaved would misleadingly flash "Offline" just because the
  // wifi icon happens to be off, with nothing pending that's actually
  // affected.
  const saveStatus: "saved" | "pending" | "saving" | "error" | "offline" =
    isOffline && (saveError || dirty || saving)
      ? "offline"
      : saveError
      ? "error"
      : saving
      ? "saving"
      : dirty
      ? "pending"
      : "saved";
  const saveStatusLabel: Record<typeof saveStatus, string> = {
    saved: "Saved",
    pending: "Unsaved changes",
    saving: "Saving…",
    error: "Save failed",
    offline: "Offline — will retry",
  };
  const saveStatusClass: Record<typeof saveStatus, string> = {
    saved: "text-ink-muted",
    pending: "text-ink-secondary",
    saving: "text-ink-secondary",
    error: "text-loss",
    offline: "text-ink-secondary",
  };

  const hasLinkedMeta = tags.length > 0 || linkedStrategy !== "" || linkedTradeIds.length > 0;

  return (
    <>
      {/* Notes polish (3rd round): the editor is now treated as the page
         itself rather than a form with an editor field at the bottom.
         Title flows directly into body copy with no divider between them;
         tags/linked strategy/linked trades — previously three stacked form
         rows above the editor — collapse into a single "Details"
         disclosure so opening a note goes straight into writing. Wider
         column (max-w-4xl vs 3xl) and no bordered/boxed editor surface —
         borderless content sitting on the page background, matching how
         Tiptap's own reference editor reads. */}
      <div className="fixed inset-0 z-40 bg-surface-0 overflow-y-auto motion-safe:animate-fade-in">
        <div className="max-w-4xl mx-auto min-h-full px-4 sm:px-10">
          <div className="sticky top-0 -mx-4 sm:-mx-10 px-4 sm:px-10 py-3 bg-surface-0/95 backdrop-blur-md border-b border-surface-border flex items-center justify-between gap-3 z-10">
            {saveStatus === "error" ? (
              <button
                type="button"
                onClick={handleSave}
                className={`text-xs text-left underline decoration-dotted shrink-0 ${saveStatusClass[saveStatus]}`}
              >
                {saveStatusLabel[saveStatus]} — tap to retry
              </button>
            ) : (
              <p className={`text-xs shrink-0 ${saveStatusClass[saveStatus]}`} aria-live="polite">
                {saveStatusLabel[saveStatus]}
              </p>
            )}
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)} disabled={saving || deleting}>
                {deleting ? "Deleting…" : "Delete"}
              </Button>
              <Button variant="secondary" size="sm" onClick={handleClose} disabled={deleting}>
                Close
              </Button>
              <Button size="sm" onClick={handleSave} disabled={!dirty || saving || deleting}>
                {saving ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>

          <div className="pb-24 pt-8 sm:pt-10">
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="w-full bg-transparent font-display text-3xl sm:text-4xl font-medium text-ink-primary placeholder:text-ink-muted/60 focus:outline-none"
              placeholder="Untitled"
            />

            <div className="mt-3 mb-6 flex items-center gap-3 text-xs">
              <button
                type="button"
                onClick={() => setDetailsOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink-primary transition-colors"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`w-3.5 h-3.5 transition-transform duration-fast ${detailsOpen ? "rotate-90" : ""}`}
                >
                  <path d="M9 6l6 6-6 6" />
                </svg>
                Details
                {!detailsOpen && hasLinkedMeta && <span className="w-1.5 h-1.5 rounded-full bg-glow" />}
              </button>
            </div>

            {detailsOpen && (
              <div className="mb-8 space-y-4 pb-6 border-b border-surface-border">
                {(tagOptions.length > 0 || orphanedTags.length > 0) && (
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-ink-muted">Tags</span>
                    <div className="mt-1.5 flex flex-wrap gap-2">
                      {tagOptions.map((o) => (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleTag(o.value)}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors duration-fast ${
                            tags.includes(o.value)
                              ? "bg-glow/15 border-glow text-glow"
                              : "border-surface-border text-ink-secondary hover:text-ink-primary"
                          }`}
                        >
                          {o.value}
                        </button>
                      ))}
                      {orphanedTags.map((t) => (
                        <button
                          key={`orphan-${t}`}
                          type="button"
                          onClick={() => toggleTag(t)}
                          title="Removed from Settings — click to remove it from this note"
                          className="px-3 py-1 rounded-full text-xs border border-dashed border-surface-border text-ink-muted hover:text-ink-primary"
                        >
                          {t} (removed from list)
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wide text-ink-muted">Linked strategy</span>
                    <Select
                      value={linkedStrategy}
                      onChange={handleLinkedStrategyChange}
                      options={[
                        { value: "", label: "—" },
                        ...strategyOptions.map((o) => ({ value: o.value, label: o.value })),
                        ...(strategyIsOrphaned
                          ? [{ value: linkedStrategy, label: `${linkedStrategy} (removed from list)`, muted: true }]
                          : []),
                      ]}
                      fullWidth
                    />
                  </div>

                  <LinkedTradesPicker
                    trades={trades}
                    linkedTradeIds={linkedTradeIds}
                    onChange={handleLinkedTradeIdsChange}
                    onOpenTrade={onOpenTrade ? handleOpenTrade : undefined}
                  />
                </div>
              </div>
            )}

            <NoteEditorErrorBoundary>
              <NoteEditor
                content={content}
                onChange={handleContentChange}
                placeholder="Start writing…"
                accountId={selectedAccount?.id ?? null}
              />
            </NoteEditorErrorBoundary>
          </div>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this note?"
        description={`"${title || "Untitled"}" will be permanently deleted. This can't be undone.`}
        confirmLabel="Delete"
        onConfirm={() => {
          setConfirmingDelete(false);
          onDelete();
        }}
        onCancel={() => setConfirmingDelete(false)}
      />
    </>
  );
}
