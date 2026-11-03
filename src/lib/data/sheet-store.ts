import "server-only";
import { connection } from "next/server";
import type { SnapshotOf } from "@/lib/sheets/db";
import type { RowIn, TableSet } from "@/lib/sheets/schema";

/** What a store needs from SheetDb / MemoryDb. */
export interface DbLike<T extends TableSet> {
  readonly spreadsheetId: string;
  readAll(): Promise<SnapshotOf<T>>;
  readTab<N extends keyof T & string>(name: N): Promise<{ rows: { data: RowIn<T, N> }[] }>;
  insert<N extends keyof T & string>(name: N, rows: RowIn<T, N>[]): Promise<void>;
  update<N extends keyof T & string>(name: N, key: string, patch: Partial<RowIn<T, N>>): Promise<RowIn<T, N>>;
  updateMany<N extends keyof T & string>(name: N, changes: { key: string; patch: Partial<RowIn<T, N>> }[]): Promise<RowIn<T, N>[]>;
  remove(name: keyof T & string, keys: string[]): Promise<void>;
  ensureSchema(): Promise<string[]>;
  tabTitles(): Promise<string[]>;
  deleteTab(title: string): Promise<void>;
}

/**
 * Cached access to one spreadsheet. One batchGet serves every page; writes
 * through the store drop the snapshot so the next read is fresh. Other server
 * instances (serverless) catch up within TTL_MS.
 */
const TTL_MS = 30_000;

export interface SheetStore<T extends TableSet> {
  readonly db: DbLike<T>;
  snapshot(): Promise<SnapshotOf<T>>;
  rows<N extends keyof T & string>(name: N): Promise<RowIn<T, N>[]>;
  /** Fresh read of one tab, bypassing the cache (for checks right before a write). */
  fresh<N extends keyof T & string>(name: N): Promise<RowIn<T, N>[]>;
  insert<N extends keyof T & string>(name: N, items: RowIn<T, N>[]): Promise<void>;
  update<N extends keyof T & string>(name: N, key: string, patch: Partial<RowIn<T, N>>): Promise<RowIn<T, N>>;
  updateMany<N extends keyof T & string>(name: N, changes: { key: string; patch: Partial<RowIn<T, N>> }[]): Promise<RowIn<T, N>[]>;
  remove(name: keyof T & string, keys: string[]): Promise<void>;
  invalidate(): void;
}

export function createStore<T extends TableSet>(db: DbLike<T>, label: string): SheetStore<T> {
  let cached: SnapshotOf<T> | undefined;
  let loadedAt = 0;
  let inflight: Promise<SnapshotOf<T>> | undefined;

  const invalidate = () => {
    cached = undefined;
    loadedAt = 0;
  };

  async function snapshot() {
    // The sheet is live data: always read at request time, never at build.
    await connection();
    if (cached && Date.now() - loadedAt < TTL_MS) return cached;
    inflight ??= db
      .readAll()
      .then((s) => {
        cached = s;
        loadedAt = Date.now();
        for (const [tab, r] of Object.entries(s as Record<string, { errors: unknown[] }>)) {
          if (r.errors.length) console.warn(`[sheets:${label}] ${tab}: ${r.errors.length} invalid row(s)`, r.errors.slice(0, 3));
        }
        return s;
      })
      .finally(() => {
        inflight = undefined;
      });
    return inflight;
  }

  async function write<R>(fn: () => Promise<R>): Promise<R> {
    try {
      return await fn();
    } finally {
      invalidate();
    }
  }

  return {
    db,
    snapshot,
    invalidate,
    async rows(name) {
      const s = await snapshot();
      return s[name].rows.map((r) => r.data);
    },
    async fresh(name) {
      return (await db.readTab(name)).rows.map((r) => r.data);
    },
    insert: (name, items) => write(() => db.insert(name, items)),
    update: (name, key, patch) => write(() => db.update(name, key, patch)),
    updateMany: (name, changes) => write(() => db.updateMany(name, changes)),
    remove: (name, keys) => write(() => db.remove(name, keys)),
  };
}
