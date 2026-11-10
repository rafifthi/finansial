import { describe, expect, it } from "vitest";
import type { Page, PageBlock } from "@/lib/sheets/schema";
import { assignPositions, CELL_CHARS, diffBlocks, docFromRows, joinJson, mentionIds, nodeText, savedMap, splitJson, type DocNode } from "./blocks";
import { ancestors, buildTree, withDescendants } from "./tree";

const p = (id: string, text: string): DocNode => ({ type: "paragraph", attrs: { id }, content: [{ type: "text", text }] });

const row = (id: string, position: number, node?: DocNode, text = ""): PageBlock => ({
  id,
  page_id: "pg",
  position,
  type: node?.type ?? "paragraph",
  text,
  ...splitJson(node ? JSON.stringify(node) : ""),
  mentions: "",
  updated_at: "",
  updated_by: "",
});

describe("splitJson", () => {
  it("spreads a long node over the json columns and joins it back", () => {
    const json = "x".repeat(CELL_CHARS * 2 + 10);
    const cells = splitJson(json);
    expect(cells.json).toHaveLength(CELL_CHARS);
    expect(cells.json_3).toHaveLength(10);
    expect(joinJson(cells)).toBe(json);
  });

  it("refuses a node too long for one row", () => {
    expect(() => splitJson("x".repeat(CELL_CHARS * 4 + 1))).toThrow(/too long/);
  });
});

describe("nodeText", () => {
  it("puts each paragraph of a list on its own line", () => {
    const list: DocNode = {
      type: "bulletList",
      content: [
        { type: "listItem", content: [p("a", "Milk")] },
        { type: "listItem", content: [p("b", "Eggs")] },
      ],
    };
    expect(nodeText(list)).toBe("Milk\nEggs");
  });

  it("keeps marks' text inline", () => {
    const node: DocNode = {
      type: "paragraph",
      content: [
        { type: "text", text: "Pay " },
        { type: "text", text: "PLN", marks: [{ type: "bold" }] },
      ],
    };
    expect(nodeText(node)).toBe("Pay PLN");
  });
});

describe("mentions, dates and tables in the plain copy", () => {
  const mention = (id: string, label: string): DocNode => ({ type: "mention", attrs: { id, label } });
  it("writes people as @Name and dates as YYYY-MM-DD", () => {
    const node: DocNode = { type: "paragraph", content: [{ type: "text", text: "Ask " }, mention("u-kanza", "Kanza"), { type: "text", text: " by " }, { type: "dateChip", attrs: { value: "2026-11-20" } }] };
    expect(nodeText(node)).toBe("Ask @Kanza by 2026-11-20");
  });

  it("collects each mentioned person once", () => {
    const node: DocNode = { type: "bulletList", content: [{ type: "listItem", content: [{ type: "paragraph", content: [mention("a", "A"), mention("b", "B"), mention("a", "A")] }] }] };
    expect(mentionIds(node)).toEqual(["a", "b"]);
  });

  it("keeps a table's rows on lines and cells apart by tabs", () => {
    const cell = (t: string): DocNode => ({ type: "tableCell", content: [p("x", t)] });
    const table: DocNode = { type: "table", content: [{ type: "tableRow", content: [cell("Bill"), cell("Due")] }, { type: "tableRow", content: [cell("PLN"), cell("20th")] }] };
    expect(nodeText(table)).toBe("Bill\tDue\nPLN\t20th");
  });
});

describe("docFromRows", () => {
  it("orders blocks by position and gives each its row id", () => {
    const doc = docFromRows([row("b", 2048, p("x", "two")), row("a", 1024, p("a", "one"))]);
    expect(doc.content!.map((n) => n.attrs!.id)).toEqual(["a", "b"]);
  });

  it("turns a hand-typed row into paragraphs", () => {
    const doc = docFromRows([row("h", 1024, undefined, "first\nsecond")]);
    expect(doc.content!.map(nodeText)).toEqual(["first", "second"]);
  });

  it("falls back to the plain copy when the JSON is damaged", () => {
    const damaged = { ...row("d", 1024, undefined, "kept"), json: "{oops" };
    expect(nodeText(docFromRows([damaged]).content![0])).toBe("kept");
  });

  it("gives an empty page one paragraph", () => {
    expect(docFromRows([]).content).toEqual([{ type: "paragraph" }]);
  });
});

describe("assignPositions", () => {
  it("keeps every position when nothing moved", () => {
    const prev = new Map([["a", 1], ["b", 2], ["c", 3]]);
    expect([...assignPositions(["a", "b", "c"], prev)]).toEqual([["a", 1], ["b", 2], ["c", 3]]);
  });

  it("places new blocks between their neighbours", () => {
    const out = assignPositions(["a", "n1", "n2", "b"], new Map([["a", 0], ["b", 3]]));
    expect(out.get("n1")).toBe(1);
    expect(out.get("n2")).toBe(2);
  });

  it("rewrites only the moved block", () => {
    const prev = new Map([["a", 1024], ["b", 2048], ["c", 3072], ["d", 4096]]);
    const out = assignPositions(["a", "d", "b", "c"], prev);
    const changed = [...out].filter(([id, pos]) => prev.get(id) !== pos).map(([id]) => id);
    expect(changed).toEqual(["d"]);
    expect(out.get("a")! < out.get("d")! && out.get("d")! < out.get("b")!).toBe(true);
  });

  it("numbers a brand-new page from the top", () => {
    expect([...assignPositions(["x", "y"], new Map()).values()]).toEqual([1024, 2048]);
  });
});

describe("diffBlocks", () => {
  const rows = [row("a", 1024, p("a", "one")), row("b", 2048, p("b", "two"))];

  it("finds nothing when the document matches what was saved", () => {
    expect(diffBlocks(savedMap(rows), docFromRows(rows))).toEqual({ upserts: [], removes: [] });
  });

  it("sends edited and new blocks, and the ids of deleted ones", () => {
    const doc: DocNode = { type: "doc", content: [p("a", "one!"), p("c", "three")] };
    const { upserts, removes } = diffBlocks(savedMap(rows), doc);
    expect(upserts.map((u) => u.id)).toEqual(["a", "c"]);
    expect(removes).toEqual(["b"]);
  });

  it("waits for the editor to give a block an id", () => {
    const doc: DocNode = { type: "doc", content: [p("a", "one"), p("b", "two"), { type: "paragraph" }] };
    expect(diffBlocks(savedMap(rows), doc).upserts).toEqual([]);
  });

  it("rewrites a hand-typed row on the first save", () => {
    const hand = [row("h", 1024, undefined, "first\nsecond")];
    const { upserts } = diffBlocks(savedMap(hand), docFromRows(hand));
    expect(upserts.map((u) => u.id)).toEqual(["h", "h-1"]);
  });
});

const page = (id: string, parent_id = "", position = 0, archived = false): Page => ({
  id,
  parent_id,
  title: id,
  emoji: "",
  position,
  version: 0,
  archived,
  editing: "",
  created_at: "",
  created_by: "",
  updated_at: "",
  updated_by: "",
});

describe("page tree", () => {
  it("nests pages, orders siblings, hides archived branches and lifts orphans to the top", () => {
    const tree = buildTree([page("b", "", 2), page("a", "", 1), page("a1", "a"), page("gone", "", 3, true), page("under-gone", "gone"), page("orphan", "missing", 4)]);
    expect(tree.map((n) => n.page.id)).toEqual(["a", "b", "orphan"]);
    expect(tree[0].children.map((n) => n.page.id)).toEqual(["a1"]);
  });

  it("survives a loop typed into the sheet", () => {
    const tree = buildTree([page("x", "y"), page("y", "x"), page("top")]);
    expect(tree.map((n) => n.page.id)).toEqual(["top"]);
  });

  it("collects descendants and ancestors", () => {
    const pages = [page("a"), page("b", "a"), page("c", "b"), page("d")];
    expect(withDescendants(pages, "a")).toEqual(["a", "b", "c"]);
    expect(ancestors(pages, "c").map((x) => x.id)).toEqual(["a", "b"]);
  });
});
