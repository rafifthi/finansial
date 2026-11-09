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
