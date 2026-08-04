import type { JSONContent } from "@tiptap/react";

/**
 * Local draft persistence for notes while editing.
 * This is NOT server autosave — it only protects against mobile browser
 * background/kill, accidental tab discard, and full reloads. Explicit Save
 * still writes to Supabase.
 */

const OPEN_KEY = "trade-journal:notes:open-id";
const draftKey = (id: string) => `trade-journal:notes:draft:${id}`;

export type NoteDraft = {
  title: string;
  content: JSONContent;
  updatedAt: number;
};

export function setOpenNoteId(id: string | null) {
  try {
    if (id) sessionStorage.setItem(OPEN_KEY, id);
    else sessionStorage.removeItem(OPEN_KEY);
  } catch {
    /* private mode etc. */
  }
}

export function getOpenNoteId(): string | null {
  try {
    return sessionStorage.getItem(OPEN_KEY);
  } catch {
    return null;
  }
}

export function writeDraft(id: string, title: string, content: JSONContent) {
  try {
    const payload: NoteDraft = { title, content, updatedAt: Date.now() };
    sessionStorage.setItem(draftKey(id), JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function readDraft(id: string): NoteDraft | null {
  try {
    const raw = sessionStorage.getItem(draftKey(id));
    if (!raw) return null;
    return JSON.parse(raw) as NoteDraft;
  } catch {
    return null;
  }
}

export function clearDraft(id: string) {
  try {
    sessionStorage.removeItem(draftKey(id));
  } catch {
    /* ignore */
  }
}
