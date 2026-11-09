import type { PageComment } from "@/lib/sheets/schema";

export interface Thread {
  root: PageComment;
  replies: PageComment[];
}

const byTime = (a: PageComment, b: PageComment) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/**
 * Comments grouped into threads, oldest first. A deleted first comment stays
 * (as "deleted") while it has replies; deleted replies and empty deleted
 * threads drop out. A reply whose thread is gone is shown on its own.
 */
export function buildThreads(comments: PageComment[]): Thread[] {
  const roots = new Map<string, Thread>();
  for (const c of [...comments].sort(byTime)) if (!c.parent_id) roots.set(c.id, { root: c, replies: [] });
  for (const c of [...comments].sort(byTime)) {
    if (!c.parent_id || c.deleted) continue;
    const thread = roots.get(c.parent_id);
    if (thread) thread.replies.push(c);
    else roots.set(c.id, { root: { ...c, parent_id: "" }, replies: [] });
  }
  return [...roots.values()].filter((t) => !t.root.deleted || t.replies.length > 0);
}

export interface PlacedThreads {
  /** Threads about the whole page. */
  page: Thread[];
  /** Threads on blocks still in the page, by block id. */
  blocks: Map<string, Thread[]>;
  /** Threads whose block has been deleted: shown with the page's, quoting what the block said. */
  orphaned: Thread[];
}

/** Where each thread belongs, given the ids of the blocks the page has now. */
export function placeThreads(threads: Thread[], blockIds: ReadonlySet<string>): PlacedThreads {
  const out: PlacedThreads = { page: [], blocks: new Map(), orphaned: [] };
  for (const t of threads) {
    const id = t.root.block_id;
    if (!id) out.page.push(t);
    else if (blockIds.has(id)) out.blocks.set(id, [...(out.blocks.get(id) ?? []), t]);
    else out.orphaned.push(t);
  }
  return out;
}

/** Unresolved threads per block, for the markers beside the page. */
export function openCounts(blocks: Map<string, Thread[]>): Map<string, number> {
  const out = new Map<string, number>();
  for (const [id, threads] of blocks) {
    const open = threads.filter((t) => !t.root.resolved).length;
    if (open) out.set(id, open);
  }
  return out;
}

export const QUOTE_CHARS = 200;

/** A block's words, shortened to fit a quote. */
export function quoteOf(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > QUOTE_CHARS ? `${flat.slice(0, QUOTE_CHARS - 1)}…` : flat;
}
