/** How long a "still typing" beat lasts; a page shows someone as editing until then. */
export const EDITING_TTL_MS = 90_000;

export interface Editor {
  userId: string;
  at: string;
}

/** The people in a page's `editing` cell whose last beat is still fresh. */
export function editorsOf(cell: string, now = Date.now()): Editor[] {
  return cell
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean)
    .map((e) => {
      const at = e.lastIndexOf("@");
      return { userId: e.slice(0, at), at: e.slice(at + 1) };
    })
    .filter((e) => e.userId && now - new Date(e.at).getTime() < EDITING_TTL_MS);
}

/** The cell after `userId` beats (or leaves): their entry replaced, stale ones dropped. */
export function withBeat(cell: string, userId: string, active: boolean, now = Date.now()): string {
  const others = editorsOf(cell, now).filter((e) => e.userId !== userId);
  const next = active ? [...others, { userId, at: new Date(now).toISOString() }] : others;
  return next.map((e) => `${e.userId}@${e.at}`).join(",");
}
