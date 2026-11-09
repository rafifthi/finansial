import type { Page, PageBlock, PageComment } from "@/lib/sheets/schema";
import { bodyText } from "./comment-body";

export interface MentionItem {
  kind: "block" | "comment";
  /** The block's id, or the comment's. */
  id: string;
  pageId: string;
  pageTitle: string;
  /** For a comment: its thread's first comment, to open in the panel. */
  threadId?: string;
  /** For a comment on a block: that block. */
  blockId?: string;
  /** What it says, as read (mentions as @Name). */
  text: string;
  /** Who wrote it (email) and when. */
  by: string;
  at: string;
  unread: boolean;
}

const has = (list: string, id: string) => list.split(",").some((x) => x.trim() === id);

/**
 * Everything in the Library that mentions a person, newest first: blocks on
 * live pages and comments that aren't deleted, leaving out their own words.
 * Anything changed after `seenAt` by someone else is unread.
 */
export function mentionsOf(
  user: { id: string; email: string },
  data: { pages: Page[]; blocks: PageBlock[]; comments: PageComment[] },
  seenAt: string,
): MentionItem[] {
  const live = new Map(data.pages.filter((p) => !p.archived).map((p) => [p.id, p]));
  const title = (id: string) => live.get(id)?.title.trim() || "Untitled";
  const out: MentionItem[] = [];
  for (const b of data.blocks) {
    if (!live.has(b.page_id) || !has(b.mentions, user.id) || b.updated_by === user.email) continue;
    out.push({ kind: "block", id: b.id, pageId: b.page_id, pageTitle: title(b.page_id), text: b.text, by: b.updated_by, at: b.updated_at, unread: b.updated_at > seenAt });
  }
  for (const c of data.comments) {
    if (c.deleted || !live.has(c.page_id) || !has(c.mentions, user.id) || c.created_by === user.email) continue;
    out.push({
      kind: "comment",
      id: c.id,
      pageId: c.page_id,
      pageTitle: title(c.page_id),
      threadId: c.parent_id || c.id,
      blockId: c.block_id || undefined,
      text: bodyText(c.body),
      by: c.created_by,
      at: c.created_at,
      unread: c.created_at > seenAt,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at));
}
