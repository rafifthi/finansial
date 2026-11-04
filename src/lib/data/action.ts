import "server-only";
import { refresh } from "next/cache";
import { z } from "zod";
import { PermissionError, requireBook, requireUser, type BookContext } from "@/auth";
import type { Permission } from "@/lib/auth/roles";
import type { PublicUser } from "@/lib/auth/users";
import { bookStore, type BookStore } from "./store";

export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; /** Per-field messages, keyed by input name, for forms to show inline. */ fieldErrors?: Record<string, string> };

/** Thrown inside an action when specific inputs are wrong; forms show each message next to its field. */
export class FieldErrors extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(Object.values(fields)[0] ?? "Check the highlighted fields.");
  }
}

/** Plain-language messages for schema issues; Zod's defaults read like a stack trace. */
export function fieldErrorsFrom(issues: z.core.$ZodIssue[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? "");
    if (!key || out[key]) continue;
    const generic = /^Invalid (input|option)|^Too (small|big)|^Expected/i.test(issue.message);
    out[key] = !generic
      ? issue.message
      : issue.code === "invalid_type" && (issue.message.includes("undefined") || issue.message.includes("NaN"))
        ? "This is required."
        : issue.code === "too_small"
          ? "This is too small."
          : issue.code === "too_big"
            ? "This is too big."
            : "Check this value.";
  }
  return out;
}

function invalid(error: z.ZodError): { ok: false; error: string; fieldErrors: Record<string, string> } {
  const fieldErrors = fieldErrorsFrom(error.issues);
  return { ok: false, error: Object.values(fieldErrors)[0] ?? "Check the highlighted fields.", fieldErrors };
}

function failure(err: unknown): { ok: false; error: string; fieldErrors?: Record<string, string> } {
  if (err instanceof FieldErrors) return { ok: false, error: err.message, fieldErrors: err.fields };
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
    if (!parsed.success) return invalid(parsed.error);
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
    if (!parsed.success) return invalid(parsed.error);
    try {
      const data = await fn(parsed.data, ctx);
      refresh();
      return { ok: true, data: data ?? undefined };
    } catch (err) {
      return failure(err);
    }
  };
}
