import type { SnapshotOf } from "./db";
import { type RowIn, type TableSet, type Tables, TABLES } from "./schema";

type Store<T extends TableSet> = { [N in keyof T]: RowIn<T, N>[] };

/**
 * Drop-in stand-in for SheetDb that keeps tables in memory. Used for local
 * development (DB_DRIVER=memory) before Google credentials exist, for both
 * book sheets and the registry.
 */
export class MemoryDb<T extends TableSet = Tables> {
  readonly tables: T;
  private store: Record<string, Record<string, unknown>[]>;
  /** Extra tab titles, to simulate a spreadsheet that isn't empty. */
  private extraTabs: string[];

  constructor(
    seed: Partial<Store<T>> = {},
    readonly spreadsheetId = "memory",
    tables?: T,
    extraTabs: string[] = [],
  ) {
    this.tables = tables ?? (TABLES as unknown as T);
    this.extraTabs = extraTabs;
    this.store = Object.fromEntries(
      Object.keys(this.tables).map((n) => [n, [...(((seed as Record<string, unknown[]>)[n] as Record<string, unknown>[]) ?? [])]]),
    );
  }

  async readAll(): Promise<SnapshotOf<T>> {
    const out: Record<string, unknown> = {};
    for (const name of Object.keys(this.tables)) out[name] = this.snapshotOf(name);
    return structuredClone(out) as SnapshotOf<T>;
  }

  async readTab<N extends keyof T & string>(name: N) {
    return structuredClone(this.snapshotOf(name)) as unknown as {
      rows: { rowNumber: number; data: RowIn<T, N>; raw: unknown[] }[];
      errors: { rowNumber: number; message: string }[];
      headers: string[];
    };
  }

  async insert<N extends keyof T & string>(name: N, rows: RowIn<T, N>[]) {
    const def = this.tables[name];
    this.list(name).push(...rows.map((r) => def.schema.parse(r) as Record<string, unknown>));
  }

  async update<N extends keyof T & string>(name: N, key: string, patch: Partial<RowIn<T, N>>): Promise<RowIn<T, N>> {
    const def = this.tables[name];
    const list = this.list(name);
    const i = list.findIndex((r) => String(r[def.key]) === key);
    if (i < 0) throw new Error(`${def.tab}: no row with ${def.key}=${key}`);
    list[i] = def.schema.parse({ ...list[i], ...patch, [def.key]: key }) as Record<string, unknown>;
    return list[i] as RowIn<T, N>;
  }

  async updateMany<N extends keyof T & string>(name: N, changes: { key: string; patch: Partial<RowIn<T, N>> }[]) {
    const out: RowIn<T, N>[] = [];
    for (const { key, patch } of changes) out.push(await this.update(name, key, patch));
    return out;
  }

  async remove(name: keyof T & string, keys: string[]) {
    const def = this.tables[name];
    const drop = new Set(keys);
    this.store[name] = this.list(name).filter((r) => !drop.has(String(r[def.key])));
  }

  async ensureSchema(): Promise<string[]> {
    for (const name of Object.keys(this.tables)) this.list(name);
    return [];
  }

  async tabTitles(): Promise<string[]> {
    return [...this.extraTabs, ...Object.keys(this.tables).map((n) => this.tables[n].tab)];
  }

  async deleteTab(title: string) {
    this.extraTabs = this.extraTabs.filter((t) => t !== title);
  }

  private list(name: string): Record<string, unknown>[] {
    return (this.store[name] ??= []);
  }

  private snapshotOf(name: string) {
    return {
      rows: this.list(name).map((data, i) => ({ rowNumber: i + 2, data, raw: [] })),
      errors: [],
      headers: Object.keys(this.tables[name].columns),
    };
  }
}
