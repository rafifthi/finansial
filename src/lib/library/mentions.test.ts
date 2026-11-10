import { describe, expect, it } from "vitest";
import type { Page, PageBlock, PageComment } from "@/lib/sheets/schema";
import { mentionsOf } from "./mentions";

const page = (id: string, archived = false) => ({ id, title: id.toUpperCase(), archived }) as Page;
const block = (id: string, page_id: string, mentions: string, updated_by: string, updated_at: string) => ({ id, page_id, mentions, text: `${id} text`, updated_by, updated_at }) as PageBlock;
const comment = (id: string, page_id: string, mentions: string, created_by: string, created_at: string, extra: Partial<PageComment> = {}) =>
  ({ id, page_id, mentions, body: "Hi @[Rafif](u-rafif)", created_by, created_at, parent_id: "", block_id: "", deleted: false, ...extra }) as PageComment;

const me = { id: "u-rafif", email: "rafif@x" };

describe("mentionsOf", () => {
  it("finds blocks and comments that mention me, newest first, with unread after the last look", () => {
    const items = mentionsOf(
      me,
      {
        pages: [page("a"), page("gone", true)],
        blocks: [block("b1", "a", "u-rafif", "kanza@x", "2026-11-09T10:00:00Z"), block("b2", "a", "u-kanza", "kanza@x", "2026-11-09T11:00:00Z"), block("b3", "gone", "u-rafif", "kanza@x", "2026-11-09T12:00:00Z")],
        comments: [comment("c1", "a", "u-rafif,u-kanza", "kanza@x", "2026-11-09T09:00:00Z", { parent_id: "root", block_id: "b1" })],
      },
      "2026-11-09T09:30:00Z",
    );
    expect(items.map((i) => [i.id, i.unread])).toEqual([
      ["b1", true],
      ["c1", false],
    ]);
    expect(items[1]).toMatchObject({ threadId: "root", blockId: "b1", text: "Hi @Rafif", pageTitle: "A" });
  });

  it("leaves out my own words and deleted comments", () => {
    const items = mentionsOf(
      me,
      {
        pages: [page("a")],
        blocks: [block("b1", "a", "u-rafif", "rafif@x", "2026-11-09T10:00:00Z")],
        comments: [comment("c1", "a", "u-rafif", "kanza@x", "2026-11-09T10:00:00Z", { deleted: true })],
      },
      "",
    );
    expect(items).toEqual([]);
  });
});
