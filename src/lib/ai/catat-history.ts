/**
 * Catat's conversation and unsaved drafts, kept in this browser for 24 hours
 * after the last change so a reload or a closed tab doesn't lose them.
 * Images aren't stored (only how many there were). Browser only; every
 * access is guarded because storage can be blocked.
 */
const TTL_MS = 24 * 60 * 60 * 1000;
const key = (bookId: string) => `finansial:catat:v1:${bookId}`;

export interface CatatSnapshot<Turn, Row> {
  savedAt: number;
  bookId: string;
  turns: Turn[];
  rows: Row[];
}

export function loadHistory<Turn, Row>(pageBookId: string): CatatSnapshot<Turn, Row> | null {
  try {
    const raw = localStorage.getItem(key(pageBookId));
    if (!raw) return null;
    const snap = JSON.parse(raw) as CatatSnapshot<Turn, Row>;
    if (!snap || typeof snap.savedAt !== "number" || Date.now() - snap.savedAt > TTL_MS) {
      localStorage.removeItem(key(pageBookId));
      return null;
    }
    return snap;
  } catch {
    return null;
  }
}

export function saveHistory<Turn, Row>(pageBookId: string, snap: Omit<CatatSnapshot<Turn, Row>, "savedAt">) {
  try {
    if (!snap.turns.length && !snap.rows.length) localStorage.removeItem(key(pageBookId));
    else localStorage.setItem(key(pageBookId), JSON.stringify({ ...snap, savedAt: Date.now() }));
  } catch {
    // Full or blocked storage: the session simply isn't kept.
  }
}
