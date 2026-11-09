"use server";

import { z } from "zod";
import { bookAction, FieldErrors } from "@/lib/data/action";
import { libraryStore } from "@/lib/data/store";
import { MAX_BLOCK_CHARS, mentionIds, nodeText, splitJson, type DocNode } from "@/lib/library/blocks";
import { nextPosition, withDescendants } from "@/lib/library/tree";
import { quoteOf } from "@/lib/library/comments";
import { PageCommentSchema, PageSchema, type Page, type PageBlock, type PageComment } from "@/lib/sheets/schema";

/*
 * The Library updates the screen before the server answers, so these actions
 * don't re-render the page (`refresh: false`). The client makes page ids and
 * the editor makes block ids, which makes a retried save harmless.
 */
const NO_REFRESH = { refresh: false };

// Ids come from the browser (nanoid, UUIDs) or from rows typed into the sheet by hand, which can be short.
const clientId = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/, "Invalid id");

/** Every page (archived ones too, for undo); the client polls this to pick up the other person's changes. */
export const syncLibrary = bookAction(
  null,
  z.object({}),
  async (_input, { book }) => {
    const store = await libraryStore(book);
    return { pages: (await store.rows("pages")) as Page[] };
  },
  NO_REFRESH,
);

/** One page and its blocks, read fresh so a poll sees the other person's last save. */
export const getPage = bookAction(
  null,
  z.object({ id: clientId }),
  async ({ id }, { book }) => {
    const store = await libraryStore(book);
    const [pages, blocks] = await Promise.all([store.fresh("pages"), store.fresh("blocks")]);
    const page = pages.find((p) => p.id === id);
    if (!page) throw new Error("This page doesn't exist any more.");
    return { page, blocks: blocks.filter((b) => b.page_id === id) };
  },
  NO_REFRESH,
);

export const createPage = bookAction(
  "data:write",
  z.object({ id: clientId, parent_id: clientId.or(z.literal("")).default(""), title: z.string().max(200).default("") }),
  async (input, { book, user }) => {
    const store = await libraryStore(book);
    const pages = await store.fresh("pages");
    const existing = pages.find((p) => p.id === input.id);
    if (existing) return existing; // a retried create
    if (input.parent_id && !pages.some((p) => p.id === input.parent_id && !p.archived)) throw new Error("The parent page is gone.");
    const now = new Date().toISOString();
    const page = PageSchema.parse({
      ...input,
      position: nextPosition(pages, input.parent_id),
      version: 0,
      created_at: now,
      created_by: user.email,
      updated_at: now,
      updated_by: user.email,
    });
    await store.insert("pages", [page]);
    return page;
  },
  NO_REFRESH,
);

const NodeSchema = z.object({ type: z.string().min(1), attrs: z.record(z.string(), z.unknown()).optional() }).loose();

const BlockSchema = z.object({
  id: clientId,
  type: z.string().regex(/^[a-zA-Z]{1,40}$/),
  position: z.number().finite(),
  json: z.string().max(MAX_BLOCK_CHARS, "This block is too long to save. Split it into smaller ones."),
});

/**
 * Saves the blocks that changed since the client's last save, plus the title.
 * Blocks the client didn't send keep whatever the sheet has, so two people
 * editing different blocks of one page both keep their work; the answer is
 * the page as it now stands, for the client to catch up with.
 */
export const savePage = bookAction(
  "data:write",
  z.object({
    id: clientId,
    title: z.string().max(200).optional(),
    upserts: z.array(BlockSchema).max(2000),
    removes: z.array(clientId).max(2000),
  }),
  async (input, { book, user }) => {
    const store = await libraryStore(book);
    const [pages, allBlocks] = await Promise.all([store.fresh("pages"), store.fresh("blocks")]);
    const page = pages.find((p) => p.id === input.id);
    if (!page) throw new Error("This page doesn't exist any more.");
    if (page.archived) throw new Error("This page is in the trash. Restore it to keep editing.");

    const now = new Date().toISOString();
    const byId = new Map(allBlocks.map((b) => [b.id, b]));
    const inserts: PageBlock[] = [];
    const updates: { key: string; patch: Partial<PageBlock> }[] = [];
    for (const b of input.upserts) {
      let node: DocNode;
      try {
        node = NodeSchema.parse(JSON.parse(b.json)) as DocNode;
      } catch {
        throw new FieldErrors({ upserts: "A block couldn't be read. Reload the page and try again." });
      }
      const existing = byId.get(b.id);
      if (existing && existing.page_id !== input.id) throw new Error("Two pages share a block. Reload the page and try again.");
      const row = { position: b.position, type: node.type, text: nodeText(node), ...splitJson(b.json), mentions: mentionIds(node).join(","), updated_at: now, updated_by: user.email };
      if (existing) updates.push({ key: b.id, patch: row });
      else inserts.push({ id: b.id, page_id: input.id, ...row });
    }
    const removes = input.removes.filter((id) => byId.get(id)?.page_id === input.id);

    // Each call is one read and one write of its tab; skip the ones with nothing to do.
    if (inserts.length) await store.insert("blocks", inserts);
    if (updates.length) await store.updateMany("blocks", updates);
    if (removes.length) await store.remove("blocks", removes);
    const changed = inserts.length + updates.length + removes.length > 0;
    const retitled = input.title !== undefined && input.title !== page.title;
    let saved = page;
    if (changed || retitled) {
      saved = await store.update("pages", page.id, {
        ...(retitled ? { title: input.title } : {}),
        version: page.version + 1,
        updated_at: now,
        updated_by: user.email,
      });
    }

    const gone = new Set(removes);
    const written = new Map([...inserts, ...updates.map((u) => ({ ...byId.get(u.key)!, ...u.patch }))].map((b) => [b.id, b]));
    const blocks = allBlocks
      .filter((b) => b.page_id === input.id && !gone.has(b.id))
      .map((b) => written.get(b.id) ?? b)
      .concat(inserts);
    return { page: saved, blocks };
  },
  NO_REFRESH,
);

/** Moves a page and everything under it to the trash. */
export const archivePage = bookAction(
  "data:write",
  z.object({ id: clientId }),
  async ({ id }, { book, user }) => {
    const store = await libraryStore(book);
    const pages = await store.fresh("pages");
    if (!pages.some((p) => p.id === id)) throw new Error("This page doesn't exist any more.");
    const ids = withDescendants(pages, id).filter((pid) => !pages.find((p) => p.id === pid)?.archived);
    const now = new Date().toISOString();
    await store.updateMany("pages", ids.map((key) => ({ key, patch: { archived: true, updated_at: now, updated_by: user.email } })));
    return { ids };
  },
  NO_REFRESH,
);

/** Undo for archivePage: brings back exactly the pages it archived. */
export const restorePages = bookAction(
  "data:write",
  z.object({ ids: z.array(clientId).min(1).max(500) }),
  async ({ ids }, { book, user }) => {
    const store = await libraryStore(book);
    const pages = await store.fresh("pages");
    const known = ids.filter((id) => pages.some((p) => p.id === id));
    const now = new Date().toISOString();
    await store.updateMany("pages", known.map((key) => ({ key, patch: { archived: false, updated_at: now, updated_by: user.email } })));
  },
  NO_REFRESH,
);

/* ---- Comments: on a block or the whole page ---- */

/** A page's comments, read fresh; the open page polls this for the other person's. */
export const listComments = bookAction(
  null,
  z.object({ page_id: clientId }),
  async ({ page_id }, { book }) => {
    const store = await libraryStore(book);
    return (await store.fresh("comments")).filter((c) => c.page_id === page_id) as PageComment[];
  },
  NO_REFRESH,
);

const Body = z.string().trim().min(1, "Write a comment first.").max(5000, "Keep it under 5,000 characters.");

export const addComment = bookAction(
  "data:write",
  z.object({
    id: clientId,
    page_id: clientId,
    block_id: z.string().max(40).default(""),
    parent_id: clientId.or(z.literal("")).default(""),
    quote: z.string().max(2000).default(""),
    body: Body,
  }),
  async (input, { book, user }) => {
    const store = await libraryStore(book);
    const [pages, comments] = await Promise.all([store.fresh("pages"), store.fresh("comments")]);
    const existing = comments.find((c) => c.id === input.id);
    if (existing) return existing; // a retried send
    if (!pages.some((p) => p.id === input.page_id && !p.archived)) throw new Error("This page doesn't exist any more.");
    // A reply joins its thread's block; only first comments carry a quote.
    const root = input.parent_id ? comments.find((c) => c.id === input.parent_id && c.page_id === input.page_id) : undefined;
    if (input.parent_id && !root) throw new Error("That thread was deleted.");
    const now = new Date().toISOString();
    const comment = PageCommentSchema.parse({
      ...input,
      block_id: root ? root.block_id : input.block_id,
      quote: root ? "" : quoteOf(input.quote),
      author_name: user.name,
      created_at: now,
      created_by: user.email,
      updated_at: now,
    });
    await store.insert("comments", [comment]);
    return comment;
  },
  NO_REFRESH,
);

/** Only the author edits or deletes a comment (book admins may delete any). */
async function ownComment(book: Parameters<typeof libraryStore>[0], id: string, email: string, admin: boolean) {
  const store = await libraryStore(book);
  const comment = (await store.fresh("comments")).find((c) => c.id === id);
  if (!comment || comment.deleted) throw new Error("That comment was deleted.");
  if (comment.created_by !== email && !admin) throw new Error("Only the person who wrote a comment can change it.");
  return { store, comment };
}

export const editComment = bookAction(
  "data:write",
  z.object({ id: clientId, body: Body }),
  async ({ id, body }, { book, user }) => {
    const { store } = await ownComment(book, id, user.email, false);
    return store.update("comments", id, { body, updated_at: new Date().toISOString() });
  },
  NO_REFRESH,
);

export const deleteComment = bookAction(
  "data:write",
  z.object({ id: clientId }),
  async ({ id }, { book, user, membership }) => {
    const { store } = await ownComment(book, id, user.email, membership.role === "admin");
    await store.update("comments", id, { deleted: true, updated_at: new Date().toISOString() });
  },
  NO_REFRESH,
);

/** Resolving closes a thread for everyone; reopening brings it back. */
export const resolveThread = bookAction(
  "data:write",
  z.object({ id: clientId, resolved: z.boolean() }),
  async ({ id, resolved }, { book, user }) => {
    const store = await libraryStore(book);
    const comment = (await store.fresh("comments")).find((c) => c.id === id);
    if (!comment) throw new Error("That thread was deleted.");
    const now = new Date().toISOString();
    return store.update("comments", comment.parent_id || comment.id, {
      resolved,
      resolved_by: resolved ? user.email : "",
      resolved_at: resolved ? now : "",
      updated_at: now,
    });
  },
  NO_REFRESH,
);
