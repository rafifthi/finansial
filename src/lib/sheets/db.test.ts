import type { sheets_v4 } from "@googleapis/sheets";
import { describe, expect, it } from "vitest";
import { SheetDb } from "./db";

type Grid = (string | number | boolean)[][];

/** Minimal in-memory imitation of the Sheets API surface SheetDb uses. */
function fakeSheets(initial: Record<string, Grid>) {
  const tabs = new Map(Object.entries(initial).map(([k, v]) => [k, v.map((r) => [...r])]));
  const ids = new Map([...tabs.keys()].map((k, i) => [k, i + 100]));
  const tabOf = (range: string) => range.match(/^'((?:[^']|'')+)'/)![1].replace(/''/g, "'");
  const colIndex = (letters: string) => [...letters].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
  const write = (range: string, values: Grid) => {
    const grid = tabs.get(tabOf(range))!;
    const m = range.match(/!([A-Z]+)(\d+)/)!;
    const [c0, r0] = [colIndex(m[1]), Number(m[2]) - 1];
    values.forEach((row, i) => {
      grid[r0 + i] ??= [];
      row.forEach((v, j) => (grid[r0 + i][c0 + j] = v));
    });
  };
  const read = (range: string) => {
    const grid = tabs.get(tabOf(range)) ?? [];
    return range.endsWith("!1:1") ? grid.slice(0, 1) : grid;
  };
  const api = {
    spreadsheets: {
      get: async () => ({ data: { sheets: [...ids].map(([title, sheetId]) => ({ properties: { title, sheetId } })) } }),
      batchUpdate: async ({ requestBody }: { requestBody: sheets_v4.Schema$BatchUpdateSpreadsheetRequest }) => {
        for (const r of requestBody.requests ?? []) {
          if (r.deleteDimension) {
            const tab = [...ids].find(([, id]) => id === r.deleteDimension!.range!.sheetId)![0];
            tabs.get(tab)!.splice(r.deleteDimension.range!.startIndex!, 1);
          }
          if (r.addSheet) {
            const title = r.addSheet.properties!.title!;
            tabs.set(title, []);
            ids.set(title, ids.size + 100);
          }
        }
        return { data: { replies: [] } };
      },
      values: {
        get: async ({ range }: { range: string }) => ({ data: { values: read(range) } }),
        batchGet: async ({ ranges }: { ranges: string[] }) => ({ data: { valueRanges: ranges.map((r) => ({ values: read(r) })) } }),
        append: async ({ range, requestBody }: { range: string; requestBody: { values: Grid } }) => {
          tabs.get(tabOf(range))!.push(...requestBody.values);
          return { data: {} };
        },
        update: async ({ range, requestBody }: { range: string; requestBody: { values: Grid } }) => {
          write(range, requestBody.values);
          return { data: {} };
        },
        batchUpdate: async ({ requestBody }: { requestBody: { data: { range: string; values: Grid }[] } }) => {
          for (const d of requestBody.data) write(d.range, d.values);
          return { data: {} };
        },
      },
    },
  };
  return { api: api as unknown as sheets_v4.Sheets, tabs };
}

const HEADER = ["id", "name", "my note", "target_amount", "starting_amount", "archived"];

describe("SheetDb", () => {
  it("inserts, updates and deletes by id while keeping user columns", async () => {
    const { api, tabs } = fakeSheets({
      Goals: [HEADER, ["g1", "Travel", "bali trip", 100, 0, false], ["g2", "House", "", 500, 0, false]],
    });
    const db = new SheetDb(api, "x");

    await db.insert("goals", [{ id: "g3", name: "Car", target_amount: 5, target_date: "", starting_amount: 0, archived: false }]);
    expect(tabs.get("Goals")![3]).toEqual(["g3", "Car", "", 5, 0, false]);

    // Someone sorts the sheet by hand: g2 moves to the top.
    const grid = tabs.get("Goals")!;
    [grid[1], grid[2]] = [grid[2], grid[1]];

    await db.update("goals", "g1", { name: "Bali" });
    expect(tabs.get("Goals")![2]).toEqual(["g1", "Bali", "bali trip", 100, 0, false]);

    await db.updateMany("goals", [
      { key: "g2", patch: { archived: true } },
      { key: "g3", patch: { starting_amount: 9 } },
    ]);
    expect(tabs.get("Goals")![1][5]).toBe(true);
    expect(tabs.get("Goals")![3][4]).toBe(9);

    await db.remove("goals", ["g2", "g3"]);
    expect(tabs.get("Goals")!.map((r) => r[0])).toEqual(["id", "g1"]);
  });

  it("creates missing tabs and header columns", async () => {
    const { api, tabs } = fakeSheets({ Goals: [["id", "name"]] });
    const db = new SheetDb(api, "x");
    const log = await db.ensureSchema();
    expect(log.join("\n")).toContain("Created tabs");
    expect(tabs.get("Goals")![0]).toEqual(["id", "name", "target_amount", "target_date", "starting_amount", "archived"]);
    expect(tabs.get("Transactions")![0]).toContain("verified");
  });
});
