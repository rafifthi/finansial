import "server-only";
import { customAlphabet } from "nanoid";
import { getSheetsClient } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { MemoryDb } from "@/lib/sheets/memory-db";
import {
  DEFAULT_SETTINGS,
  LIBRARY_TABLES,
  LIST_TABLES,
  SAVINGS_TABLES,
  STATEMENT_TABLES,
  type Book,
  type LibraryTables,
  type ListTables,
  type SavingsTables,
  type StatementTables,
  type TableSet,
  type Tables,
} from "@/lib/sheets/schema";
import { demoBookSeed, demoLibrarySeed, demoListSeed, demoSavingsSeed } from "./demo-seed";
import { createStore, type SheetStore } from "./sheet-store";

/** Local-only demo database; never selectable in a production build. */
export const usingDemoDb = () => process.env.NODE_ENV !== "production" && process.env.DB_DRIVER === "memory";

export const newId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 12);

export type BookStore = SheetStore<Tables> & {
  settings(): Promise<Record<string, string>>;
  setSetting(key: string, value: string): Promise<void>;
};

// Survive dev hot reloads: one store (and its cache) per spreadsheet.
const g = globalThis as typeof globalThis & {
  __finansialBookStores?: Map<string, BookStore>;
  __finansialModuleStores?: Map<string, Promise<unknown>>;
};
const stores = (g.__finansialBookStores ??= new Map());
const moduleStores = (g.__finansialModuleStores ??= new Map());

/** Data access for one book's spreadsheet. */
export function bookStore(book: Pick<Book, "spreadsheet_id">): BookStore {
  const id = book.spreadsheet_id;
  if (!id) throw new Error("This book has no spreadsheet connected yet.");
  let store = stores.get(id);
  if (!store) {
    const db = usingDemoDb() ? new MemoryDb<Tables>(demoBookSeed(id), id) : new SheetDb<Tables>(getSheetsClient(), id);
    const base = createStore<Tables>(db, id.slice(0, 8));
    store = {
      ...base,
      async settings() {
        const out = { ...DEFAULT_SETTINGS };
        for (const s of await base.rows("settings")) out[s.key] = s.value;
        return out;
      },
      async setSetting(key: string, value: string) {
        const exists = (await base.rows("settings")).some((s) => s.key === key);
        if (exists) await base.update("settings", key, { value });
        else await base.insert("settings", [{ key, value }]);
      },
    };
    stores.set(id, store);
  }
  return store;
}

/**
 * Tables a module keeps in its own tabs of the book's sheet. They're created on
 * first use, so books made before the module existed pick them up without a migration.
 */
function moduleStore<T extends TableSet>(book: Pick<Book, "spreadsheet_id">, key: string, tables: T, seed: () => object): Promise<SheetStore<T>> {
  const id = book.spreadsheet_id;
  if (!id) throw new Error("This book has no spreadsheet connected yet.");
  const cacheKey = `${key}:${id}`;
  let store = moduleStores.get(cacheKey) as Promise<SheetStore<T>> | undefined;
  if (!store) {
    const db = usingDemoDb() ? new MemoryDb<T>(seed(), id, tables) : new SheetDb<T>(getSheetsClient(), id, tables);
    store = db.ensureSchema().then(() => createStore<T>(db, `${id.slice(0, 8)}:${key}`));
    // A failed setup (e.g. a network blip) retries on the next request.
    store.catch(() => moduleStores.delete(cacheKey));
    moduleStores.set(cacheKey, store);
  }
  return store;
}

/** Card statements for one book (Bill check). */
export const statementStore = (book: Pick<Book, "spreadsheet_id">) => moduleStore<StatementTables>(book, "stmt", STATEMENT_TABLES, () => ({}));

/** Savings balance adjustments for one book. */
export const savingsStore = (book: Pick<Book, "spreadsheet_id">) =>
  moduleStore<SavingsTables>(book, "savings", SAVINGS_TABLES, () => demoSavingsSeed(book.spreadsheet_id));

/** Checklists (Lists) for one book. */
export const listStore = (book: Pick<Book, "spreadsheet_id">) => moduleStore<ListTables>(book, "lists", LIST_TABLES, () => demoListSeed(book.spreadsheet_id));

/** Library pages and their blocks for one book. */
export const libraryStore = (book: Pick<Book, "spreadsheet_id">) =>
  moduleStore<LibraryTables>(book, "library", LIBRARY_TABLES, () => demoLibrarySeed(book.spreadsheet_id));
