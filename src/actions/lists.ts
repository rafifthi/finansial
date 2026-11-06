"use server";

import { z } from "zod";
import { bookAction, FieldErrors, fieldErrorsFrom } from "@/lib/data/action";
import { listStore } from "@/lib/data/store";
import { LIST_SORTS, PRIORITIES, REPEATS, TodoItemSchema, TodoListSchema, type TodoItem, type TodoList } from "@/lib/sheets/schema";

/*
 * Lists update the screen before the server answers, so these actions don't
 * re-render the page (`refresh: false`). The client makes the ids, which
 * makes a retried insert harmless.
 */
const NO_REFRESH = { refresh: false };

const clientId = z.string().regex(/^[a-z0-9-]{4,40}$/, "Invalid id");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal(""));

/** Every list and item in the book; the client polls this to pick up the other person's changes. */
export const syncLists = bookAction(
  null,
  z.object({}),
  async (_input, { book }) => {
    const store = await listStore(book);
    const snap = await store.snapshot();
    return { lists: snap.lists.rows.map((r) => r.data), items: snap.items.rows.map((r) => r.data) };
  },
  NO_REFRESH,
);

export const saveList = bookAction(
  "data:write",
  z.object({
    id: clientId,
    name: z.string(),
    emoji: z.string().max(16).default(""),
    color: z.string().max(20).default(""),
    sort: z.enum(LIST_SORTS).optional(),
  }),
  async (input, { book, user }) => {
    const store = await listStore(book);
    const lists = await store.rows("lists");
    const existing = lists.find((l) => l.id === input.id);
    const parsed = TodoListSchema.safeParse(
      existing
        ? { ...existing, ...input, sort: input.sort ?? existing.sort }
        : {
            ...input,
            position: Math.max(0, ...lists.map((l) => l.position)) + 1024,
            created_at: new Date().toISOString(),
            created_by: user.email,
          },
    );
    if (!parsed.success) throw new FieldErrors(fieldErrorsFrom(parsed.error.issues));
    if (existing) await store.update("lists", input.id, parsed.data);
    else await store.insert("lists", [parsed.data]);
    return parsed.data;
  },
  NO_REFRESH,
);

/** Deletes a list with its items; returns them so the client can offer Undo. */
export const deleteList = bookAction(
  "data:write",
  z.object({ id: clientId }),
  async ({ id }, { book }) => {
    const store = await listStore(book);
    const list = (await store.rows("lists")).find((l) => l.id === id);
    const items = (await store.rows("items")).filter((i) => i.list_id === id);
    await store.remove("items", items.map((i) => i.id));
    await store.remove("lists", [id]);
    return { list, items } as { list?: TodoList; items: TodoItem[] };
  },
  NO_REFRESH,
);

export const restoreList = bookAction(
  "data:write",
  z.object({ list: z.record(z.string(), z.unknown()), items: z.array(z.record(z.string(), z.unknown())).max(2000) }),
  async (input, { book }) => {
    const list = TodoListSchema.safeParse(input.list);
    if (!list.success) throw new Error("That list can't be restored.");
    const store = await listStore(book);
    if (!(await store.rows("lists")).some((l) => l.id === list.data.id)) await store.insert("lists", [list.data]);
    await insertMissing(store, input.items);
  },
  NO_REFRESH,
);

const newItem = z.object({
  id: clientId,
  title: z.string(),
  position: z.number(),
  starred: z.boolean().optional(),
  deadline: isoDate.optional(),
  priority: z.enum(PRIORITIES).optional(),
  repeat: z.enum(REPEATS).optional(),
  note: z.string().max(2000).optional(),
});

/** Adds items (one typed line, or several pasted at once) in a single append. */
export const addItems = bookAction(
  "data:write",
  z.object({ list_id: clientId, items: z.array(newItem).min(1).max(200) }),
  async ({ list_id, items }, { book, user }) => {
    const store = await listStore(book);
    if (!(await store.rows("lists")).some((l) => l.id === list_id)) throw new Error("That list was deleted.");
    const now = new Date().toISOString();
    const rows = items.map((i) => ({ ...i, list_id, created_at: now, updated_at: now, created_by: user.email }));
    await insertMissing(store, rows);
  },
  NO_REFRESH,
);

const itemPatch = z
  .object({
    title: z.string(),
    note: z.string(),
    deadline: isoDate,
    priority: z.enum(PRIORITIES),
    repeat: z.enum(REPEATS),
    starred: z.boolean(),
    done: z.boolean(),
    position: z.number(),
    list_id: clientId,
  })
  .partial();

export type ItemPatch = z.infer<typeof itemPatch>;

/** Patches one or more items with one read and one batched write. */
export const updateItems = bookAction(
  "data:write",
  z.object({ changes: z.array(z.object({ id: clientId, patch: itemPatch })).min(1).max(2000) }),
  async ({ changes }, { book }) => {
    const store = await listStore(book);
    // The cached copy is enough to validate; updateMany re-reads the tab to find each row.
    const items = new Map((await store.rows("items")).map((i) => [i.id, i]));
    const now = new Date().toISOString();
    const valid: { key: string; patch: Partial<TodoItem> }[] = [];
    for (const { id, patch } of changes) {
      const current = items.get(id);
      // Deleted by the other person meanwhile: nothing left to change.
      if (!current) continue;
      const next: Partial<TodoItem> = { ...patch, updated_at: now };
      if (patch.done !== undefined && patch.done !== current.done) next.completed_at = patch.done ? now : "";
      const parsed = TodoItemSchema.safeParse({ ...current, ...next });
      if (!parsed.success) throw new FieldErrors(fieldErrorsFrom(parsed.error.issues));
      valid.push({ key: id, patch: next });
    }
    try {
      await store.updateMany("items", valid);
    } catch (err) {
      if (err instanceof Error && err.message.includes("no row")) throw new Error("Someone else just changed this list. It has been reloaded.");
      throw err;
    }
  },
  NO_REFRESH,
);

/** Deletes items (one, or every completed one); returns them for Undo. */
export const deleteItems = bookAction(
  "data:write",
  z.object({ ids: z.array(clientId).min(1).max(2000) }),
  async ({ ids }, { book }) => {
    const store = await listStore(book);
    const wanted = new Set(ids);
    const rows = (await store.rows("items")).filter((i) => wanted.has(i.id));
    await store.remove("items", ids);
    return rows;
  },
  NO_REFRESH,
);

export const restoreItems = bookAction(
  "data:write",
  z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(2000) }),
  async ({ rows }, { book }) => {
    await insertMissing(await listStore(book), rows);
  },
  NO_REFRESH,
);

/** Inserts the rows whose ids aren't in the sheet yet, so a repeated request never duplicates. */
async function insertMissing(store: Awaited<ReturnType<typeof listStore>>, rows: Record<string, unknown>[]) {
  // Our own writes drop the cache, so the cached copy already knows about a request that went through.
  const have = new Set((await store.rows("items")).map((i) => i.id));
  const out: TodoItem[] = [];
  for (const row of rows) {
    const parsed = TodoItemSchema.safeParse(row);
    if (!parsed.success) throw new FieldErrors(fieldErrorsFrom(parsed.error.issues));
    if (!have.has(parsed.data.id)) out.push(parsed.data);
  }
  await store.insert("items", out);
}
