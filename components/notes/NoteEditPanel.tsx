"use client";

import { useEffect, useRef, useState } from "react";
import type { JSONContent } from "@tiptap/react";
import Button from "@/components/shared/Button";
import ConfirmDialog from "@/components/shared/ConfirmDialog";
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

  const saveStatus: "saved" | "pending" | "saving" | "error" = saveError
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
  };
  const saveStatusClass: Record<typeof saveStatus, string> = {
    saved: "text-ink-muted",
    pending: "text-ink-secondary",
    saving: "text-ink-secondary",
    error: "text-loss",
  };

  return (
    <>
      {/* Notes polish (2nd round): was a Card rendered inline in the page
         flow, sandwiched between the page header and the notes list below
         it — cramped on mobile and not a real "open this note" moment.
         Rewritten as a fixed full-viewport overlay (own scroll container,
         sticky header) matching TradeFormPanel's overlay conventions, but
         full-width rather than a side slide-over — a rich-text/table/image
         editor needs the width a lot more than a quick trade-fields form
         does. */}
      <div className="fixed inset-0 z-40 bg-surface-0 overflow-y-auto motion-safe:animate-fade-in">
        <div className="max-w-3xl mx-auto min-h-full p-4 sm:p-6">
          <div className="sticky top-0 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 mb-4 bg-surface-0/95 backdrop-blur-md border-b border-surface-border flex items-start justify-between gap-3 z-10">
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="flex-1 bg-transparent font-display text-lg font-medium text-ink-primary placeholder:text-ink-muted focus:outline-none border-b border-surface-border pb-2"
              placeholder="Note title"
            />
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

          <div className="space-y-4 pb-6">

          {saveStatus === "error" ? (
            <button
              type="button"
              onClick={handleSave}
              className={`text-[11px] -mt-2 text-left underline decoration-dotted ${saveStatusClass[saveStatus]}`}
            >
              {saveStatusLabel[saveStatus]} — tap to retry
            </button>
          ) : (
            <p className={`text-[11px] -mt-2 ${saveStatusClass[saveStatus]}`} aria-live="polite">
              {saveStatusLabel[saveStatus]}
            </p>
          )}

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
              <select
                value={linkedStrategy}
                onChange={(e) => handleLinkedStrategyChange(e.target.value)}
                className="mt-1.5 w-full bg-surface-2 border border-surface-border rounded-md px-3 py-2 text-xs text-ink-primary focus:outline-none focus:border-glow/60 focus:ring-2 focus:ring-glow/20 transition-colors"
              >
                <option value="">—</option>
                {strategyOptions.map((o) => (
                  <option key={o.id} value={o.value}>
                    {o.value}
                  </option>
                ))}
                {strategyIsOrphaned && (
                  <option value={linkedStrategy} style={{ color: "#8a8f98" }}>
                    {linkedStrategy} (removed from list)
                  </option>
                )}
              </select>
            </div>

            <LinkedTradesPicker
              trades={trades}
              linkedTradeIds={linkedTradeIds}
              onChange={handleLinkedTradeIdsChange}
              onOpenTrade={onOpenTrade ? handleOpenTrade : undefined}
            />
          </div>

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
