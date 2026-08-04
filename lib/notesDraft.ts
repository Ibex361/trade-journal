import type { JSONContent } from "@tiptap/react";

/**
 * Local draft persistence for notes while editing.
 * Uses localStorage (not sessionStorage) so Samsung Internet / Chrome
 * backgrounding or process death still keep the draft.
 * This is NOT server autosave — explicit Save still writes to Supabase.
 */

const OPEN_KEY = "trade-journal:notes:open-id";
const draftKey = (id: string) => `trade-journal:notes:draft:${id}`;

export type NoteDraft = {
  title: string;
  content: JSONContent;
  updatedAt: number;
};

function storage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export function setOpenNoteId(id: string | null) {
  const s = storage();
  if (!s) return;
  try {
    if (id) s.setItem(OPEN_KEY, id);
    else s.removeItem(OPEN_KEY);
  } catch {
    /* private mode / quota */
  }
}

export function getOpenNoteId(): string | null {
  const s = storage();
  if (!s) return null;
  try {
    return s.getItem(OPEN_KEY);
  } catch {
    return null;
  }
}

export function writeDraft(id: string, title: string, content: JSONContent) {
  const s = storage();
  if (!s) return;
  try {
    const payload: NoteDraft = { title, content, updatedAt: Date.now() };
    s.setItem(draftKey(id), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readDraft(id: string): NoteDraft | null {
  const s = storage();
  if (!s) return null;
  try {
    const raw = s.getItem(draftKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as NoteDraft;
  } catch {
    return null;
  }
}

export function clearDraft(id: string) {
  const s = storage();
  if (!s) return;
  try {
    s.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
}
