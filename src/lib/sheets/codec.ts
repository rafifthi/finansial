import type { ColumnType, TableDef } from "./schema";
import { parseAmount } from "@/lib/finance/money";

/** A raw cell as returned by the Sheets API with UNFORMATTED_VALUE. */
export type Cell = string | number | boolean | null | undefined;

export interface DecodedRow<T> {
  /** 1-based sheet row number (header is row 1). */
  rowNumber: number;
  data: T;
  /** The original cells, kept so updates preserve user-added columns. */
  raw: Cell[];
}

export interface DecodeResult<T> {
  rows: DecodedRow<T>[];
  errors: { rowNumber: number; message: string }[];
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Google Sheets serial date (days since 1899-12-30) → YYYY-MM-DD. */
export function serialToIsoDate(serial: number): string {
  const ms = Math.round((serial - 25569) * 86400 * 1000);
  const d = new Date(ms);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function toIsoDate(value: Cell): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return serialToIsoDate(value);
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return `${iso[1]}-${pad(+iso[2])}-${pad(+iso[3])}`;
  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return s; // let schema validation report it
  return `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}`;
}

export function toMonth(value: Cell): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "string" && /^\d{4}-\d{1,2}$/.test(value.trim())) {
    const [y, m] = value.trim().split("-");
    return `${y}-${pad(+m)}`;
  }
  return toIsoDate(value)?.slice(0, 7);
}

export function decodeCell(value: Cell, type: ColumnType): unknown {
  if (value === null || value === undefined || value === "") return undefined;
  switch (type) {
    case "string":
      return String(value).trim();
    case "number":
      return typeof value === "number" ? value : parseAmount(String(value));
    case "boolean":
      if (typeof value === "boolean") return value;
      return ["true", "1", "yes", "y"].includes(String(value).trim().toLowerCase());
    case "date":
      return toIsoDate(value);
    case "month":
      return toMonth(value);
  }
}

export function encodeCell(value: unknown): string | number | boolean {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" || typeof value === "boolean") return value;
  return String(value);
}

export const normalizeHeader = (h: Cell) => String(h ?? "").trim().toLowerCase();

/** Map of column name → 0-based index in the sheet, from the header row. */
export function headerIndex(headers: Cell[]): Map<string, number> {
  const map = new Map<string, number>();
  headers.forEach((h, i) => {
    const name = normalizeHeader(h);
    if (name && !map.has(name)) map.set(name, i);
  });
  return map;
}

export function missingColumns(def: TableDef, headers: Cell[]): string[] {
  const idx = headerIndex(headers);
  return Object.keys(def.columns).filter((c) => !idx.has(c));
}

export function decodeRows<T>(def: TableDef, values: Cell[][]): DecodeResult<T> {
  const [headers = [], ...body] = values;
  const idx = headerIndex(headers);
  const rows: DecodedRow<T>[] = [];
  const errors: DecodeResult<T>["errors"] = [];

  body.forEach((raw, i) => {
    const rowNumber = i + 2;
    if (!raw || raw.every((c) => c === "" || c === null || c === undefined)) return;
    const obj: Record<string, unknown> = {};
    for (const [col, type] of Object.entries(def.columns)) {
      const at = idx.get(col);
      obj[col] = at === undefined ? undefined : decodeCell(raw[at], type);
    }
    const parsed = def.schema.safeParse(obj);
    if (parsed.success) rows.push({ rowNumber, data: parsed.data as T, raw });
    else
      errors.push({
        rowNumber,
        message: parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      });
  });

  return { rows, errors };
}

/**
 * Builds the cell array for a row in the sheet's own column order. Columns the
 * app doesn't know about keep their existing values from `base`.
 */
export function encodeRow(def: TableDef, headers: Cell[], data: Record<string, unknown>, base: Cell[] = []): Cell[] {
  const idx = headerIndex(headers);
  const width = Math.max(headers.length, base.length);
  const out: Cell[] = Array.from({ length: width }, (_, i) => base[i] ?? "");
  for (const col of Object.keys(def.columns)) {
    const at = idx.get(col);
    if (at === undefined) continue;
    if (col in data) out[at] = encodeCell(data[col]);
  }
  return out;
}

/** 0-based column index → A1 column letters. */
export function columnLetter(index: number): string {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const quoteTab = (tab: string) => `'${tab.replace(/'/g, "''")}'`;
