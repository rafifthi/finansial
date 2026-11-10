import { describe, expect, it } from "vitest";
import type { Page, PageBlock } from "@/lib/sheets/schema";
import { planMove, stepMove } from "./tree";
import { searchPages, snippetAround } from "./search";

const page = (id: string, title: string, parent_id = "", position = 1024, archived = false) => ({ id, title, parent_id, position, archived, emoji: "" }) as Page;
const block = (id: string, page_id: string, text: string, position = 1024) => ({ id, page_id, text, position }) as PageBlock;

describe("searchPages", () => {
  const pages = [page("wifi", "Wi-Fi & utilities"), page("house", "House info"), page("old", "Wi-Fi old", "", 1024, true)];
  const blocks = [block("b1", "house", "The router password is on the fridge"), block("b2", "wifi", "Router: 192.168.1.1"), block("b3", "wifi", "Provider IndiHome")];

  it("needs every word, across the title and blocks, and ranks title matches first", () => {
    expect(searchPages(pages, blocks, "router").map((h) => h.pageId)).toEqual(["house", "wifi"]);
    expect(searchPages(pages, blocks, "wifi router").map((h) => h.pageId)).toEqual(["wifi"]);
    expect(searchPages(pages, blocks, "wi-fi").map((h) => h.pageId)).toEqual(["wifi"]);
  });

  it("points at the block that matched and leaves archived pages out", () => {
    const [hit] = searchPages(pages, blocks, "indihome");
    expect(hit).toMatchObject({ pageId: "wifi", blockId: "b3", snippet: "Provider IndiHome" });
    expect(searchPages(pages, blocks, "old")).toEqual([]);
  });

  it("ignores case and accents", () => {
    expect(searchPages([page("c", "Café notes")], [], "CAFE").map((h) => h.pageId)).toEqual(["c"]);
  });

  it("cuts long text around the first match", () => {
    const long = `${"filler ".repeat(40)}the router is here ${"more ".repeat(40)}`;
    const s = snippetAround(long, ["router"], 60);
    expect(s.startsWith("…") && s.endsWith("…") && s.includes("router")).toBe(true);
  });
});

describe("moving pages", () => {
  const pages = [page("a", "A", "", 1024), page("b", "B", "", 2048), page("c", "C", "", 3072), page("a1", "A1", "a", 1024)];

  it("drops before, after or inside another page", () => {
    expect(planMove(pages, "c", "a", "before")).toEqual({ parent_id: "", position: 0 });
    expect(planMove(pages, "c", "a", "after")).toEqual({ parent_id: "", position: 1536 });
    expect(planMove(pages, "c", "a", "inside")).toEqual({ parent_id: "a", position: 2048 });
  });

  it("refuses to drop a page onto itself or under its own pages", () => {
    expect(planMove(pages, "a", "a", "after")).toBeNull();
    expect(planMove(pages, "a", "a1", "inside")).toBeNull();
  });

  it("steps up, down and out", () => {
    expect(stepMove(pages, "b", "up")).toEqual({ parent_id: "", position: 0 });
    expect(stepMove(pages, "b", "down")).toEqual({ parent_id: "", position: 4096 });
    expect(stepMove(pages, "c", "down")).toBeNull();
    expect(stepMove(pages, "a1", "out")).toEqual({ parent_id: "", position: 1536 });
  });
});

describe("snippetAround with punctuation", () => {
  it("cuts around the right place even when punctuation comes before the match", () => {
    const text = `${"a.b.c-d, ".repeat(30)}find the router here ${"tail ".repeat(30)}`;
    expect(snippetAround(text, ["router"], 50)).toContain("router");
  });
});

import { editorsOf, withBeat } from "./presence";

describe("editing presence", () => {
  const now = Date.parse("2026-11-10T10:00:00Z");
  it("keeps fresh beats, replaces your own and drops stale ones", () => {
    const cell = "u-kanza@2026-11-10T09:59:30.000Z,u-old@2026-11-10T09:50:00.000Z";
    expect(editorsOf(cell, now).map((e) => e.userId)).toEqual(["u-kanza"]);
    const mine = withBeat(cell, "u-rafif", true, now);
    expect(editorsOf(mine, now).map((e) => e.userId)).toEqual(["u-kanza", "u-rafif"]);
    expect(editorsOf(withBeat(mine, "u-rafif", false, now), now).map((e) => e.userId)).toEqual(["u-kanza"]);
  });
});
