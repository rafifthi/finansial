import "server-only";
import { customAlphabet } from "nanoid";
import { getSheetsClient } from "@/lib/sheets/client";
import { SheetDb } from "@/lib/sheets/db";
import { MemoryDb } from "@/lib/sheets/memory-db";
import { DEFAULT_SETTINGS, STATEMENT_TABLES, type Book, type StatementTables, type Tables } from "@/lib/sheets/schema";
import { demoBookSeed } from "./demo-seed";
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
  __finansialStatementStores?: Map<string, Promise<SheetStore<StatementTables>>>;
};
const stores = (g.__finansialBookStores ??= new Map());
const statementStores = (g.__finansialStatementStores ??= new Map());

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
 * Card statements for one book. Its tabs are created on first use, so books
 * made before the module existed pick them up without a migration.
 */
export function statementStore(book: Pick<Book, "spreadsheet_id">): Promise<SheetStore<StatementTables>> {
  const id = book.spreadsheet_id;
  if (!id) throw new Error("This book has no spreadsheet connected yet.");
  let store = statementStores.get(id);
  if (!store) {
    const db = usingDemoDb()
      ? new MemoryDb<StatementTables>({}, id, STATEMENT_TABLES)
      : new SheetDb<StatementTables>(getSheetsClient(), id, STATEMENT_TABLES);
    store = db.ensureSchema().then(() => createStore<StatementTables>(db, `${id.slice(0, 8)}:stmt`));
    // A failed setup (e.g. a network blip) retries on the next request.
    store.catch(() => statementStores.delete(id));
    statementStores.set(id, store);
  }
  return store;
}
