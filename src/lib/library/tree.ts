import { STEP } from "@/lib/lists/order";
import type { Page } from "@/lib/sheets/schema";
import { byPosition } from "./blocks";

export interface PageNode {
  page: Page;
  children: PageNode[];
}

/**
 * The page tree, siblings in order. Archived pages are left out with
 * everything under them; a page whose parent is gone sits at the top.
 */
export function buildTree(pages: Page[]): PageNode[] {
  const all = new Map(pages.map((p) => [p.id, p]));
  const kids = new Map<string, Page[]>();
  for (const p of pages) {
    if (p.archived) continue;
    // Under an archived page: hidden with it (unreachable below). Parent missing: top level.
    const parent = p.parent_id && all.has(p.parent_id) && p.parent_id !== p.id ? p.parent_id : "";
    kids.set(parent, [...(kids.get(parent) ?? []), p]);
  }
  const seen = new Set<string>();
  const build = (parent: string): PageNode[] =>
    (kids.get(parent) ?? [])
      .sort(byPosition)
      // A loop typed into the sheet (A under B under A) can't recurse forever.
      .filter((p) => !seen.has(p.id) && seen.add(p.id))
      .map((page) => ({ page, children: build(page.id) }));
  return build("");
}

/** The page and every page under it, the page first. */
export function withDescendants(pages: Page[], id: string): string[] {
  const out = [id];
  for (let i = 0; i < out.length; i++) {
    for (const p of pages) if (p.parent_id === out[i] && !out.includes(p.id)) out.push(p.id);
  }
  return out;
}

/** The pages from the top of the tree down to `id`'s parent, for breadcrumbs. */
export function ancestors(pages: Page[], id: string): Page[] {
  const byId = new Map(pages.map((p) => [p.id, p]));
  const out: Page[] = [];
  let at = byId.get(id)?.parent_id;
  while (at && byId.has(at) && !out.some((p) => p.id === at)) {
    out.unshift(byId.get(at)!);
    at = byId.get(at)!.parent_id;
  }
  return out;
}

/** Where a new page goes: after its last sibling. */
export function nextPosition(pages: Page[], parentId: string): number {
  const siblings = pages.filter((p) => p.parent_id === parentId);
  return siblings.length ? Math.max(...siblings.map((p) => p.position)) + STEP : STEP;
}

export const pageTitle = (p: Pick<Page, "title">) => p.title.trim() || "Untitled";

export type DropZone = "before" | "after" | "inside";

/**
 * Where a page dragged onto another lands: just before or after it among its
 * siblings, or as its last child. Null when the move makes no sense (onto
 * itself, or under one of its own pages, which would cut it off the tree).
 */
export function planMove(pages: Page[], id: string, targetId: string, zone: DropZone): { parent_id: string; position: number } | null {
  if (id === targetId) return null;
  const target = pages.find((p) => p.id === targetId);
  if (!target || withDescendants(pages, id).includes(targetId)) return null;
  if (zone === "inside") return { parent_id: target.id, position: nextPosition(pages.filter((p) => p.id !== id), target.id) };
  const siblings = pages.filter((p) => p.parent_id === target.parent_id && p.id !== id && !p.archived).sort(byPosition);
  const at = siblings.findIndex((p) => p.id === targetId);
  const before = zone === "before" ? siblings[at - 1] : siblings[at];
  const after = zone === "before" ? siblings[at] : siblings[at + 1];
  const position =
    before && after ? (before.position + after.position) / 2 : before ? before.position + STEP : after ? after.position - STEP : STEP;
  return { parent_id: target.parent_id, position };
}

/** Keyboard moves from a page's menu: up or down among its siblings, or out to sit after its parent. */
export function stepMove(pages: Page[], id: string, step: "up" | "down" | "out"): { parent_id: string; position: number } | null {
  const page = pages.find((p) => p.id === id);
  if (!page) return null;
  if (step === "out") return page.parent_id ? planMove(pages, id, page.parent_id, "after") : null;
  const siblings = pages.filter((p) => p.parent_id === page.parent_id && !p.archived).sort(byPosition);
  const at = siblings.findIndex((p) => p.id === id);
  const neighbour = siblings[step === "up" ? at - 1 : at + 1];
  return neighbour ? planMove(pages, id, neighbour.id, step === "up" ? "before" : "after") : null;
}
