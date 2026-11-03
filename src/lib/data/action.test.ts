import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import type { Membership } from "@/lib/sheets/schema";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ refresh: vi.fn() }));
vi.mock("./store", () => ({ bookStore: () => ({ fake: true }) }));

/** Who is signed in, and their memberships (book id → role). */
let session: { id: string; books: Record<string, Membership["role"]> } | null = null;

vi.mock("@/auth", async () => {
  const { can } = await import("@/lib/auth/roles");
  class PermissionError extends Error {}
  class BookNotFoundError extends PermissionError {
    constructor() {
      super("Book not found.");
    }
  }
  const user = () => ({ id: session!.id, email: `${session!.id}@x.id`, name: session!.id, is_system_admin: false, disabled: false, created_at: "", last_login_at: "" });
  return {
    PermissionError,
    BookNotFoundError,
    requireUser: async () => {
      if (!session) throw new PermissionError("Your session has ended. Sign in again.");
      return user();
    },
    requireBook: async (bookId: string, permission?: Parameters<typeof can>[1]) => {
      if (!session) throw new PermissionError("Your session has ended. Sign in again.");
      const role = session.books[bookId];
      if (!role) throw new BookNotFoundError();
      if (permission && !can(role, permission)) throw new PermissionError("Your role doesn't allow this.");
      return { user: user(), book: { id: bookId }, membership: { role } };
    },
  };
});

const { bookAction, userAction } = await import("./action");

describe("bookAction()", () => {
  const work = vi.fn(async (n: number) => n * 2);
  const write = bookAction("data:write", z.number(), work);
  const manage = bookAction("users:manage", z.number(), work);

  beforeEach(() => {
    work.mockClear();
    session = null;
  });

  it("rejects anonymous callers without running the body", async () => {
    expect(await write("b1", 1)).toEqual({ ok: false, error: "Your session has ended. Sign in again." });
    expect(work).not.toHaveBeenCalled();
  });

  it("treats books you aren't in as not found", async () => {
    session = { id: "u1", books: { b1: "admin" } };
    expect(await write("b2", 1)).toEqual({ ok: false, error: "Book not found." });
    expect(await write("", 1)).toEqual({ ok: false, error: "Book not found." });
    expect(work).not.toHaveBeenCalled();
  });

  it("checks the role in that specific book", async () => {
    session = { id: "u1", books: { family: "viewer", personal: "admin" } };
    expect(await write("family", 1)).toMatchObject({ ok: false, error: "Your role doesn't allow this." });
    expect(await write("personal", 2)).toEqual({ ok: true, data: 4 });
    session = { id: "u2", books: { family: "member" } };
    expect(await write("family", 3)).toEqual({ ok: true, data: 6 });
    expect(await manage("family", 3)).toMatchObject({ ok: false });
  });

  it("validates input before running", async () => {
    session = { id: "u1", books: { b1: "admin" } };
    expect(await write("b1", "x" as unknown as number)).toMatchObject({ ok: false });
    expect(work).not.toHaveBeenCalled();
  });
});

describe("userAction()", () => {
  it("needs a session", async () => {
    session = null;
    const act = userAction(z.object({}), async () => "ok");
    expect(await act({})).toMatchObject({ ok: false });
    session = { id: "u1", books: {} };
    expect(await act({})).toEqual({ ok: true, data: "ok" });
  });
});
