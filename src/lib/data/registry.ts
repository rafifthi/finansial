import "server-only";
import { getSheetsClient } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { MemoryDb } from "@/lib/sheets/memory-db";
import { REGISTRY_TABLES, type Book, type Membership, type RegistryTables } from "@/lib/sheets/schema";
import { demoRegistrySeed } from "./demo-seed";
import { createStore, type SheetStore } from "./sheet-store";
import { usingDemoDb } from "./store";

/**
 * The registry spreadsheet: Users, Books, Memberships, Invites. One per
 * deployment, separate from every book sheet so password hashes never live
 * in a sheet that household members open.
 */
const g = globalThis as typeof globalThis & { __finansialRegistry?: SheetStore<RegistryTables> };

export function registryConfigured() {
  return usingDemoDb() || Boolean(process.env.REGISTRY_SPREADSHEET_ID);
}

export function registry(): SheetStore<RegistryTables> {
  if (g.__finansialRegistry) return g.__finansialRegistry;
  let db;
  if (usingDemoDb()) {
    db = new MemoryDb<RegistryTables>(demoRegistrySeed(), "demo-registry", REGISTRY_TABLES);
  } else {
    const id = process.env.REGISTRY_SPREADSHEET_ID;
    if (!id) {
      throw new Error(
        "REGISTRY_SPREADSHEET_ID is not set. Create a blank sheet, share it with the service account (Editor), add its ID to .env.local and run pnpm migrate:multibook.",
      );
    }
    db = new SheetDb<RegistryTables>(getSheetsClient(), id, REGISTRY_TABLES);
  }
  return (g.__finansialRegistry = createStore(db, "registry"));
}

export interface BookAccess {
  book: Book;
  membership: Membership;
}

/** Every book the user belongs to (archived ones excluded), most recently opened first. */
export async function booksOf(userId: string): Promise<BookAccess[]> {
  const [books, memberships] = await Promise.all([registry().rows("books"), registry().rows("memberships")]);
  const byId = new Map(books.map((b) => [b.id, b]));
  return memberships
    .filter((m) => m.user_id === userId)
    .map((membership) => ({ membership, book: byId.get(membership.book_id) }))
    .filter((x): x is BookAccess => Boolean(x.book) && x.book!.status !== "archived")
    .sort(
      (a, b) =>
        b.membership.last_opened_at.localeCompare(a.membership.last_opened_at) ||
        (a.book.kind === b.book.kind ? a.book.name.localeCompare(b.book.name) : a.book.kind === "family" ? -1 : 1),
    );
}

/** The user's access to one book, or null when they aren't a member (callers 404). */
export async function accessTo(userId: string, bookId: string): Promise<BookAccess | null> {
  return (await booksOf(userId)).find((x) => x.book.id === bookId) ?? null;
}

/** Remembers the last-opened book; at most one write per hour per membership. */
export async function touchMembership(m: Membership) {
  const now = new Date();
  if (m.last_opened_at && now.getTime() - new Date(m.last_opened_at).getTime() < 3_600_000) return;
  await registry()
    .update("memberships", m.id, { last_opened_at: now.toISOString() })
    .catch(() => {});
}
