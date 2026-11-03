import type { sheets_v4 } from "@googleapis/sheets";
import {
  type Cell,
  type DecodeResult,
  columnLetter,
  decodeRows,
  encodeRow,
  headerIndex,
  missingColumns,
  quoteTab,
} from "./codec";
import { type RowIn, type TableSet, type Tables, TABLES } from "./schema";

export type SnapshotOf<T extends TableSet> = { [N in keyof T]: DecodeResult<RowIn<T, N>> & { headers: Cell[] } };
/** Snapshot of a book spreadsheet. */
export type Snapshot = SnapshotOf<Tables>;

const READ_OPTS = {
  valueRenderOption: "UNFORMATTED_VALUE",
  dateTimeRenderOption: "FORMATTED_STRING",
} as const;

/**
 * Thin repository over one spreadsheet. Every write re-reads the tab first so
 * row numbers are current even if someone sorted or edited the sheet by hand.
 * Writes use RAW input so values are stored exactly (no locale parsing, no
 * formula injection from descriptions).
 */
export class SheetDb<T extends TableSet = Tables> {
  private sheetIds = new Map<string, number>();
  readonly tables: T;

  constructor(
    private api: sheets_v4.Sheets,
    readonly spreadsheetId: string,
    tables?: T,
  ) {
    this.tables = tables ?? (TABLES as unknown as T);
  }

  private names() {
    return Object.keys(this.tables) as (keyof T & string)[];
  }

  async readAll(): Promise<SnapshotOf<T>> {
    const names = this.names();
    const res = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.spreadsheetId,
      ranges: names.map((n) => quoteTab(this.tables[n].tab)),
      ...READ_OPTS,
    });
    const out = {} as Record<string, unknown>;
    names.forEach((name, i) => {
      const values = (res.data.valueRanges?.[i]?.values ?? []) as Cell[][];
      out[name] = { ...decodeRows(this.tables[name], values), headers: values[0] ?? [] };
    });
    return out as SnapshotOf<T>;
  }

  async readTab<N extends keyof T & string>(name: N) {
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: quoteTab(this.tables[name].tab),
      ...READ_OPTS,
    });
    const values = (res.data.values ?? []) as Cell[][];
    return { ...decodeRows<RowIn<T, N>>(this.tables[name], values), headers: values[0] ?? [] };
  }

  async insert<N extends keyof T & string>(name: N, rows: RowIn<T, N>[]) {
    if (rows.length === 0) return;
    const def = this.tables[name];
    const parsed = rows.map((r) => def.schema.parse(r) as Record<string, unknown>);
    const headers = await this.headers(name);
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: `${quoteTab(def.tab)}!A1`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: parsed.map((r) => encodeRow(def, headers, r)) },
    });
  }

  async update<N extends keyof T & string>(name: N, key: string, patch: Partial<RowIn<T, N>>): Promise<RowIn<T, N>> {
    const [row] = await this.updateMany(name, [{ key, patch }]);
    return row;
  }

  /** Applies several patches with one read and one batched write. */
  async updateMany<N extends keyof T & string>(
    name: N,
    changes: { key: string; patch: Partial<RowIn<T, N>> }[],
  ): Promise<RowIn<T, N>[]> {
    if (changes.length === 0) return [];
    const def = this.tables[name];
    const { rows, headers } = await this.readTab(name);
    const byKey = new Map(rows.map((r) => [String((r.data as Record<string, unknown>)[def.key]), r]));
    const data: sheets_v4.Schema$ValueRange[] = [];
    const results: RowIn<T, N>[] = [];
    for (const { key, patch } of changes) {
      const row = byKey.get(key);
      if (!row) throw new Error(`${def.tab}: no row with ${def.key}=${key}`);
      const next = def.schema.parse({ ...row.data, ...patch, [def.key]: key }) as RowIn<T, N>;
      const cells = encodeRow(def, headers, next as Record<string, unknown>, row.raw);
      data.push({
        range: `${quoteTab(def.tab)}!A${row.rowNumber}:${columnLetter(cells.length - 1)}${row.rowNumber}`,
        values: [cells],
      });
      results.push(next);
    }
    await this.api.spreadsheets.values.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data },
    });
    return results;
  }

  async remove(name: keyof T & string, keys: string[]) {
    if (keys.length === 0) return;
    const def = this.tables[name];
    const { rows } = await this.readTab(name);
    const wanted = new Set(keys);
    const targets = rows
      .filter((r) => wanted.has(String((r.data as Record<string, unknown>)[def.key])))
      .map((r) => r.rowNumber)
      .sort((a, b) => b - a); // bottom-up so earlier deletions don't shift later ones
    if (targets.length === 0) return;
    const sheetId = await this.sheetId(def.tab);
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: {
        requests: targets.map((rowNumber) => ({
          deleteDimension: {
            range: { sheetId, dimension: "ROWS", startIndex: rowNumber - 1, endIndex: rowNumber },
          },
        })),
      },
    });
  }

  /** Creates missing tabs, adds missing header columns, freezes and bolds row 1. */
  async ensureSchema(): Promise<string[]> {
    const log: string[] = [];
    await this.loadSheetIds();
    const missingTabs = Object.values(this.tables).filter((t) => !this.sheetIds.has(t.tab));
    if (missingTabs.length) {
      const res = await this.api.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: { requests: missingTabs.map((t) => ({ addSheet: { properties: { title: t.tab } } })) },
      });
      res.data.replies?.forEach((r) => {
        const p = r.addSheet?.properties;
        if (p?.title && p.sheetId != null) this.sheetIds.set(p.title, p.sheetId);
      });
      log.push(`Created tabs: ${missingTabs.map((t) => t.tab).join(", ")}`);
    }

    const formatRequests: sheets_v4.Schema$Request[] = [];
    for (const name of this.names()) {
      const def = this.tables[name];
      const headers = await this.readHeaderRow(name);
      const missing = missingColumns(def, headers);
      if (missing.length) {
        const start = headers.length;
        await this.api.spreadsheets.values.update({
          spreadsheetId: this.spreadsheetId,
          range: `${quoteTab(def.tab)}!${columnLetter(start)}1`,
          valueInputOption: "RAW",
          requestBody: { values: [missing] },
        });
        log.push(`${def.tab}: added columns ${missing.join(", ")}`);
      }
      const sheetId = this.sheetIds.get(def.tab)!;
      formatRequests.push(
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
            cell: { userEnteredFormat: { textFormat: { bold: true } } },
            fields: "userEnteredFormat.textFormat.bold",
          },
        },
      );
    }
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: formatRequests },
    });
    return log;
  }

  /** Titles of every tab in the spreadsheet, in order. */
  async tabTitles(): Promise<string[]> {
    await this.loadSheetIds();
    return [...this.sheetIds.keys()];
  }

  /** Deletes a whole tab by title (used once, when moving Users out of a book sheet). */
  async deleteTab(title: string) {
    const sheetId = await this.sheetId(title);
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.spreadsheetId,
      requestBody: { requests: [{ deleteSheet: { sheetId } }] },
    });
    this.sheetIds.delete(title);
  }

  private async headers(name: keyof T & string): Promise<Cell[]> {
    const headers = await this.readHeaderRow(name);
    if (headerIndex(headers).size === 0) throw new Error(`Tab "${this.tables[name].tab}" has no header row.`);
    return headers;
  }

  private async readHeaderRow(name: keyof T & string): Promise<Cell[]> {
    const def = this.tables[name];
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.spreadsheetId,
      range: `${quoteTab(def.tab)}!1:1`,
    });
    return (res.data.values?.[0] ?? []) as Cell[];
  }

  private async sheetId(tab: string): Promise<number> {
    if (!this.sheetIds.has(tab)) await this.loadSheetIds();
    const id = this.sheetIds.get(tab);
    if (id === undefined) throw new Error(`Tab "${tab}" not found.`);
    return id;
  }

  private async loadSheetIds() {
    this.sheetIds.clear();
    const res = await this.api.spreadsheets.get({
      spreadsheetId: this.spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    for (const s of res.data.sheets ?? []) {
      if (s.properties?.title && s.properties.sheetId != null) this.sheetIds.set(s.properties.title, s.properties.sheetId);
    }
  }
}
