"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addComment, deleteComment, editComment, listComments, resolveThread } from "@/actions/library";
import { toast } from "@/components/base/toast/toast";
import type { ActionResult } from "@/lib/data/action";
import type { PageComment } from "@/lib/sheets/schema";
import { newClientId } from "../lists/use-lists";

const POLL_MS = 30_000;

export interface NewComment {
  block_id?: string;
  parent_id?: string;
  quote?: string;
  body: string;
}

/**
 * A page's comments, kept in the browser: changes show at once and are
 * undone with a message if the server refuses them. The other person's
 * comments arrive by polling while nothing of ours is on its way.
 */
export function useComments(bookId: string, pageId: string, initial: PageComment[], me: { email: string; name: string }) {
  const [comments, setComments] = useState(initial);
  const pending = useRef(0);

  const sync = useCallback(
    async (force = false) => {
      if (!force && (pending.current || document.visibilityState !== "visible")) return;
      const res = await listComments(bookId, { page_id: pageId });
      if (res.ok && res.data && (force || !pending.current)) setComments(res.data);
    },
    [bookId, pageId],
  );

  useEffect(() => {
    const id = window.setInterval(() => void sync(), POLL_MS);
    return () => window.clearInterval(id);
  }, [sync]);

  /** Applies a change now and sends it; on failure, shows why and reloads what the sheet has. */
  const run = useCallback(
    async <T>(change: (all: PageComment[]) => PageComment[], send: () => Promise<ActionResult<T>>): Promise<boolean> => {
      setComments(change);
      pending.current++;
      let ok = false;
      try {
        const res = await send();
        ok = res.ok;
        if (!res.ok) toast(res.error, { status: "error" });
      } catch {
        toast("You're offline. That wasn't saved.", { status: "error" });
      } finally {
        pending.current--;
      }
      if (!ok) void sync(true);
      return ok;
    },
    [sync],
  );

  const add = useCallback(
    (input: NewComment) => {
      const now = new Date().toISOString();
      const comment: PageComment = {
        id: newClientId(),
        page_id: pageId,
        block_id: input.block_id ?? "",
        parent_id: input.parent_id ?? "",
        quote: input.parent_id ? "" : (input.quote ?? ""),
        body: input.body.trim(),
        resolved: false,
        resolved_by: "",
        resolved_at: "",
        deleted: false,
        author_name: me.name,
        created_at: now,
        created_by: me.email,
        updated_at: now,
      };
      return run(
        (all) => [...all, comment],
        () => addComment(bookId, { id: comment.id, page_id: pageId, block_id: comment.block_id, parent_id: comment.parent_id, quote: comment.quote, body: comment.body }),
      );
    },
    [bookId, me, pageId, run],
  );

  const edit = useCallback(
    (id: string, body: string) =>
      run(
        (all) => all.map((c) => (c.id === id ? { ...c, body: body.trim(), updated_at: new Date().toISOString() } : c)),
        () => editComment(bookId, { id, body }),
      ),
    [bookId, run],
  );

  const remove = useCallback(
    (id: string) =>
      run(
        (all) => all.map((c) => (c.id === id ? { ...c, deleted: true } : c)),
        () => deleteComment(bookId, { id }),
      ),
    [bookId, run],
  );

  const resolve = useCallback(
    (rootId: string, resolved: boolean) =>
      run(
        (all) => all.map((c) => (c.id === rootId ? { ...c, resolved, resolved_by: resolved ? me.email : "", resolved_at: resolved ? new Date().toISOString() : "" } : c)),
        () => resolveThread(bookId, { id: rootId, resolved }),
      ),
    [bookId, me.email, run],
  );

  return { comments, add, edit, remove, resolve };
}

export type CommentsApi = ReturnType<typeof useComments>;
