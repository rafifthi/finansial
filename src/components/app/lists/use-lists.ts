"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { customAlphabet } from "nanoid";
import { addItems, deleteItems, deleteList, restoreItems, restoreList, saveList, syncLists, updateItems, type ItemPatch } from "@/actions/lists";
import { toast } from "@/components/base/toast/toast";
import type { ActionResult } from "@/lib/data/action";
import { nextDeadline, STEP, topPosition } from "@/lib/lists/order";
import type { TodoItem, TodoList } from "@/lib/sheets/schema";
import { undoToast } from "../undo";

export interface ListsData {
  lists: TodoList[];
  items: TodoItem[];
}

export type ListInput = Pick<TodoList, "id" | "name" | "emoji" | "color"> & Partial<Pick<TodoList, "sort">>;

/** What a new item can start with; everything else takes its default. */
export type ItemDraft = Pick<TodoItem, "title"> & Partial<Pick<TodoItem, "id" | "position" | "note" | "deadline" | "priority" | "repeat" | "starred">>;

const toNewItem = ({ id, title, position, starred, deadline, priority, repeat, note }: TodoItem) => ({ id, title, position, starred, deadline, priority, repeat, note });

export const newClientId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

/** How long the server's 30s cache can lag behind a write on another instance. */
const SETTLE_MS = 31_000;
const POLL_MS = 30_000;

/** A full row for a new item, with a fresh id. */
function makeItem(listId: string, draft: ItemDraft, position: number, now: string, user: string): TodoItem {
  return {
    id: draft.id ?? newClientId(),
    list_id: listId,
    title: draft.title,
    note: draft.note ?? "",
    deadline: draft.deadline ?? "",
    priority: draft.priority ?? "",
    repeat: draft.repeat ?? "",
    starred: draft.starred ?? false,
    done: false,
    position,
    completed_at: "",
    created_at: now,
    created_by: user,
    updated_at: now,
  };
}

/**
 * Lists' state lives in the browser: every change shows at once and its write
 * joins a queue, so the sheet sees changes in the order they were made. The
 * other person's changes arrive by polling, but never over changes of ours
 * the server may not have caught up on yet.
 */
export function useLists(bookId: string, initial: ListsData, user: string) {
  const [data, setData] = useState(initial);
  // The latest state, updated as each change is made, so changes made in quick succession build on each other.
  const current = useRef(initial);
  const commit = useCallback((next: ListsData) => {
    current.current = next;
    setData(next);
  }, []);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const pending = useRef(0);
  const lastWrite = useRef(0);

  const sync = useCallback(
    async (force = false) => {
      const quiet = () => pending.current === 0 && Date.now() - lastWrite.current > SETTLE_MS;
      if (!force && !quiet()) return;
      const res = await syncLists(bookId, {});
      if (res.ok && res.data && (force || quiet())) commit(res.data);
    },
    [bookId, commit],
  );

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const timer = window.setInterval(onVisible, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [sync]);

  /** Applies a change locally, then queues its write; a failed write reloads the truth. */
  const run = useCallback(
    <T>(apply: (d: ListsData) => ListsData, call: () => Promise<ActionResult<T>>, failure: string) => {
      commit(apply(current.current));
      pending.current++;
      const done = queue.current
        .then(call)
        .catch((err: unknown): ActionResult<T> => ({ ok: false, error: err instanceof Error ? err.message : "Check your connection." }))
        .then((res) => {
          if (!res.ok) {
            toast(failure, { status: "error", description: res.error });
            void sync(true);
          }
          return res;
        })
        .finally(() => {
          pending.current--;
          lastWrite.current = Date.now();
        });
      queue.current = done;
      return done;
    },
    [commit, sync],
  );

  const patchItems = useCallback(
    (changes: { id: string; patch: ItemPatch }[], failure = "Couldn't save the change") => {
      if (!changes.length) return;
      const byId = new Map(changes.map((c) => [c.id, c.patch]));
      const now = new Date().toISOString();
      return run(
        (d) => ({
          ...d,
          items: d.items.map((i) => {
            const patch = byId.get(i.id);
            if (!patch) return i;
            const completed_at = patch.done === undefined || patch.done === i.done ? i.completed_at : patch.done ? now : "";
            return { ...i, ...patch, completed_at, updated_at: now };
          }),
        }),
        () => updateItems(bookId, { changes }),
        failure,
      );
    },
    [bookId, run],
  );

  /** New items go on top, in the order typed or pasted, unless a draft brings its own position. */
  const add = useCallback(
    (listId: string, drafts: ItemDraft[]) => {
      if (!drafts.length) return;
      const now = new Date().toISOString();
      const top = topPosition(current.current.items.filter((i) => i.list_id === listId && !i.done));
      const rows = drafts.map((d, i) => makeItem(listId, d, d.position ?? top - (drafts.length - 1 - i) * STEP, now, user));
      return run(
        (d) => ({ ...d, items: [...rows, ...d.items] }),
        () => addItems(bookId, { list_id: listId, items: rows.map(toNewItem) }),
        drafts.length > 1 ? "Couldn't add those items" : "Couldn't add the item",
      );
    },
    [bookId, run, user],
  );

  /**
   * Ticks an item. A repeating one is done for this time: the ticked row stops
   * repeating and a fresh copy takes its place with the next deadline, so the
   * sheet keeps one row per occurrence.
   */
  const complete = useCallback(
    (item: TodoItem, today: string) => {
      if (item.done || !item.repeat) return patchItems([{ id: item.id, patch: { done: !item.done } }]);
      const now = new Date().toISOString();
      const next = makeItem(item.list_id, { ...item, id: undefined, deadline: nextDeadline(item.deadline, item.repeat, today) }, item.position, now, user);
      return run(
        (d) => ({
          ...d,
          items: [next, ...d.items.map((i) => (i.id === item.id ? { ...i, done: true, repeat: "" as const, completed_at: now, updated_at: now } : i))],
        }),
        async () => {
          const res = await updateItems(bookId, { changes: [{ id: item.id, patch: { done: true, repeat: "" } }] });
          return res.ok ? addItems(bookId, { list_id: item.list_id, items: [toNewItem(next)] }) : res;
        },
        "Couldn't tick that off",
      );
    },
    [bookId, patchItems, run, user],
  );

  const removeItems = useCallback(
    (rows: TodoItem[], title: string) => {
      if (!rows.length) return;
      const ids = new Set(rows.map((r) => r.id));
      void run(
        (d) => ({ ...d, items: d.items.filter((i) => !ids.has(i.id)) }),
        () => deleteItems(bookId, { ids: [...ids] }),
        "Couldn't delete",
      ).then((res) => {
        if (!res.ok) return;
        undoToast(title, () =>
          run(
            (d) => ({ ...d, items: [...d.items.filter((i) => !ids.has(i.id)), ...rows] }),
            () => restoreItems(bookId, { rows }),
            "Couldn't restore",
          ),
        );
      });
    },
    [bookId, run],
  );

  const upsertList = useCallback(
    (input: ListInput) => {
      const now = new Date().toISOString();
      return run(
        (d) => {
          const existing = d.lists.find((l) => l.id === input.id);
          if (existing) return { ...d, lists: d.lists.map((l) => (l.id === input.id ? { ...l, ...input } : l)) };
          const position = Math.max(0, ...d.lists.map((l) => l.position)) + 1024;
          return { ...d, lists: [...d.lists, { sort: "manual", position, created_at: now, created_by: user, ...input }] };
        },
        () => saveList(bookId, input),
        "Couldn't save the list",
      );
    },
    [bookId, run, user],
  );

  const removeList = useCallback(
    (list: TodoList) => {
      const items = current.current.items.filter((i) => i.list_id === list.id);
      void run(
        (d) => ({ lists: d.lists.filter((l) => l.id !== list.id), items: d.items.filter((i) => i.list_id !== list.id) }),
        () => deleteList(bookId, { id: list.id }),
        "Couldn't delete the list",
      ).then((res) => {
        if (!res.ok) return;
        undoToast(`Deleted ${list.name}`, () =>
          run(
            (d) => ({ lists: [...d.lists.filter((l) => l.id !== list.id), list], items: [...d.items.filter((i) => i.list_id !== list.id), ...items] }),
            () => restoreList(bookId, { list, items }),
            "Couldn't restore the list",
          ),
        );
      });
    },
    [bookId, run],
  );

  return { data, patchItems, add, complete, removeItems, upsertList, removeList };
}
