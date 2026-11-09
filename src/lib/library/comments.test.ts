import { describe, expect, it } from "vitest";
import type { PageComment } from "@/lib/sheets/schema";
import { buildThreads, openCounts, placeThreads, quoteOf } from "./comments";

let t = 0;
const c = (id: string, extra: Partial<PageComment> = {}): PageComment => ({
  id,
  page_id: "pg",
  block_id: "",
  parent_id: "",
  quote: "",
  body: id,
  resolved: false,
  resolved_by: "",
  resolved_at: "",
  deleted: false,
  author_name: "",
  created_at: `2026-11-09T10:00:${String(++t).padStart(2, "0")}Z`,
  created_by: "",
  updated_at: "",
  ...extra,
});

describe("buildThreads", () => {
  it("puts replies under their thread, oldest first", () => {
    const threads = buildThreads([c("r2", { parent_id: "a" }), c("a"), c("r1", { parent_id: "a", created_at: "2026-11-09T09:00:00Z" })]);
    expect(threads).toHaveLength(1);
    expect(threads[0].replies.map((r) => r.id)).toEqual(["r1", "r2"]);
  });

  it("keeps a deleted first comment only while it has replies", () => {
    const threads = buildThreads([c("gone", { deleted: true }), c("kept", { deleted: true }), c("reply", { parent_id: "kept" })]);
    expect(threads.map((th) => th.root.id)).toEqual(["kept"]);
  });

  it("drops deleted replies and shows a reply without its thread on its own", () => {
    const threads = buildThreads([c("a"), c("x", { parent_id: "a", deleted: true }), c("lost", { parent_id: "nowhere" })]);
    expect(threads.map((th) => [th.root.id, th.replies.length])).toEqual([
      ["a", 0],
      ["lost", 0],
    ]);
  });
});

describe("placeThreads", () => {
  it("splits page threads, block threads and threads whose block is gone", () => {
    const threads = buildThreads([c("p"), c("b", { block_id: "blk" }), c("o", { block_id: "deleted-blk" })]);
    const placed = placeThreads(threads, new Set(["blk"]));
    expect(placed.page.map((th) => th.root.id)).toEqual(["p"]);
    expect(placed.blocks.get("blk")?.map((th) => th.root.id)).toEqual(["b"]);
    expect(placed.orphaned.map((th) => th.root.id)).toEqual(["o"]);
  });

  it("counts only unresolved threads per block", () => {
    const threads = buildThreads([c("a", { block_id: "x" }), c("b", { block_id: "x", resolved: true }), c("d", { block_id: "y", resolved: true })]);
    expect([...openCounts(placeThreads(threads, new Set(["x", "y"])).blocks)]).toEqual([["x", 1]]);
  });
});

describe("quoteOf", () => {
  it("flattens lines and shortens long text", () => {
    expect(quoteOf("Milk\n  Eggs")).toBe("Milk Eggs");
    expect(quoteOf("x".repeat(300))).toHaveLength(200);
  });
});
