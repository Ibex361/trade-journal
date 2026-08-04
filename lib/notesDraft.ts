import type { JSONContent } from "@tiptap/react";

/**
 * Local draft persistence for notes while editing.
 * Uses localStorage so backgrounding still keeps the draft.
 * NOT server autosave — explicit Save writes to Supabase.
 */

const OPEN_KEY = "trade-journal:notes:open-id";
const draftKey = (id: string) => `trade-journal:notes:draft:${id}`;

export type NoteDraft = {
  title: string;
  content: JSONContent;
  tags?: string[];
  linked_trade_id?: string | null;
  linked_strategy?: string | null;
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

export function writeDraft(
  id: string,
  title: string,
  content: JSONContent,
  extra?: {
    tags?: string[];
    linked_trade_id?: string | null;
    linked_strategy?: string | null;
  }
) {
  const s = storage();
  if (!s) return;
  try {
    const payload: NoteDraft = {
      title,
      content,
      tags: extra?.tags,
      linked_trade_id: extra?.linked_trade_id,
      linked_strategy: extra?.linked_strategy,
      updatedAt: Date.now(),
    };
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
