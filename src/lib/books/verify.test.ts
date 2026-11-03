import { describe, expect, it } from "vitest";
import { parseSheetId, verifySheet, type SheetProbe } from "./verify";

const ID = "1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789_-abcd";
const SA = "finansial@proj.iam.gserviceaccount.com";

/** Fake Google: a few sheets with different sharing and contents. */
function probe(sheets: Record<string, { tabs?: [string, boolean][]; canEdit?: boolean; owners?: string[]; writers?: string[]; shared?: boolean; meta?: string; drive?: "off" }>): SheetProbe {
  return {
    async spreadsheet(id) {
      const s = sheets[id];
      if (!s || s.shared === false) return { error: "not_found" };
      return { title: `Sheet ${id.slice(0, 4)}`, tabs: (s.tabs ?? [["Sheet1", false]]).map(([title, hasData]) => ({ title, hasData })) };
    },
    async file(id) {
      const s = sheets[id];
      if (s.drive === "off") return { error: "drive_disabled" };
      return { canEdit: s.canEdit ?? true, owners: s.owners ?? ["me@gmail.com"], writers: s.writers };
    },
    async claimedBy(id) {
      return sheets[id]?.meta ?? null;
    },
  };
}

const base = { userEmail: "me@gmail.com", serviceAccount: SA, usedSheetIds: new Set<string>() };
const failed = (r: Awaited<ReturnType<typeof verifySheet>>) => r.checks.filter((c) => c.status === "fail").map((c) => c.id);

describe("parseSheetId", () => {
  it("accepts links and bare ids", () => {
    expect(parseSheetId(`https://docs.google.com/spreadsheets/d/${ID}/edit?usp=sharing`)).toBe(ID);
    expect(parseSheetId(`  https://docs.google.com/spreadsheets/u/1/d/${ID}/edit#gid=0 `)).toBe(ID);
    expect(parseSheetId(ID)).toBe(ID);
    expect(parseSheetId("https://example.com/whatever")).toBeNull();
    expect(parseSheetId("hello")).toBeNull();
  });
});

describe("verifySheet — new book", () => {
  const book = (sheets: Parameters<typeof probe>[0], extra = {}) =>
    verifySheet(probe(sheets), { ...base, purpose: "book", input: ID, ...extra });

  it("passes an empty sheet you own, shared as Editor", async () => {
    const r = await book({ [ID]: {} });
    expect(r.ok).toBe(true);
    expect(r.checks.map((c) => c.id)).toEqual(["link", "open", "edit", "yours", "empty", "unused"]);
  });
  it("explains each failure", async () => {
    expect(failed(await verifySheet(probe({}), { ...base, purpose: "book", input: "nope" }))).toEqual(["link"]);
    const notShared = await book({ [ID]: { shared: false } });
    expect(failed(notShared)).toEqual(["open"]);
    expect(notShared.checks[1].detail).toContain(SA);
    expect(failed(await book({ [ID]: { canEdit: false } }))).toEqual(["edit"]);
    expect(failed(await book({ [ID]: { owners: ["someone@gmail.com"] } }))).toEqual(["yours"]);
    expect(failed(await book({ [ID]: { tabs: [["Sheet1", true]] } }))).toEqual(["empty"]);
    expect(failed(await book({ [ID]: {} }, { usedSheetIds: new Set([ID]) }))).toEqual(["unused"]);
    expect(failed(await book({ [ID]: { drive: "off" } }))).toEqual(["yours"]);
  });
  it("accepts an editor (not owner) and a sheet you're resuming", async () => {
    expect((await book({ [ID]: { owners: ["spouse@gmail.com"], writers: ["me@gmail.com"] } })).ok).toBe(true);
    const claimed = { [ID]: { tabs: [["_meta", true], ["Transactions", true]] as [string, boolean][], meta: "b1" } };
    expect(failed(await book(claimed))).toEqual(["empty"]);
    expect((await book(claimed, { resumingBookId: "b1", usedSheetIds: new Set([ID]) })).ok).toBe(true);
  });
});

describe("verifySheet — import", () => {
  const imp = (sheets: Parameters<typeof probe>[0]) => verifySheet(probe(sheets), { ...base, purpose: "import", input: ID });
  it("needs read access, your ownership and the Money Management tabs", async () => {
    const tabs: [string, boolean][] = [["⚙️Setup", true], ["Budgeting", true], ["Spending", true]];
    expect((await imp({ [ID]: { tabs, canEdit: false } })).ok).toBe(true);
    expect(failed(await imp({ [ID]: { tabs: [["Sheet1", true]] } }))).toEqual(["format"]);
    expect(failed(await imp({ [ID]: { tabs, owners: ["other@gmail.com"] } }))).toEqual(["yours"]);
  });
});
