import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { PermissionError, requireBook, requireUser, type BookContext } from "@/auth";
import type { Permission } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/users";
import { bookStore, type BookStore } from "./store";

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

function failure(err: unknown): { ok: false; error: string } {
  if (err instanceof PermissionError) return { ok: false, error: err.message };
  console.error(err);
  return { ok: false, error: err instanceof Error ? err.message : "Something went wrong." };
}

/**
 * Server actions are public HTTP endpoints, so every one re-checks the
 * session (and, for books, membership and role), validates its input and
 * refreshes the client router on success.
 */
export function userAction<S extends z.ZodType, T = undefined>(
  schema: S,
  fn: (input: z.infer<S>, user: PublicUser) => Promise<T | void>,
) {
  return async (raw: z.input<S>): Promise<ActionResult<T>> => {
    let user: PublicUser;
    try {
      user = await requireUser();
    } catch (err) {
      return failure(err);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    try {
      const data = await fn(parsed.data, user);
      refresh();
      return { ok: true, data: data ?? undefined };
    } catch (err) {
      return failure(err);
    }
  };
}

export interface BookActionContext extends BookContext {
  store: BookStore;
}

/**
 * A server action scoped to one book: called as `action(bookId, input)`.
 * Non-members get "Book not found"; `permission` is checked against the
 * caller's role in *that* book.
 */
export function bookAction<S extends z.ZodType, T = undefined>(
  permission: Permission | null,
  schema: S,
  fn: (input: z.infer<S>, ctx: BookActionContext) => Promise<T | void>,
) {
  return async (bookId: string, raw: z.input<S>): Promise<ActionResult<T>> => {
    let ctx: BookActionContext;
    try {
      if (typeof bookId !== "string" || !bookId) throw new PermissionError("Book not found.");
      const access = await requireBook(bookId, permission ?? undefined);
      ctx = { ...access, store: bookStore(access.book) };
    } catch (err) {
      return failure(err);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.message).join("; ") };
    try {
      const data = await fn(parsed.data, ctx);
      refresh();
      return { ok: true, data: data ?? undefined };
    } catch (err) {
      return failure(err);
    }
  };
}
