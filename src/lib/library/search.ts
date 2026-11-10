import type { Page, PageBlock } from "@/lib/sheets/schema";

export interface SearchHit {
  pageId: string;
  title: string;
  emoji: string;
  /** The block where the words were found, to jump to; none when only the title matched. */
  blockId?: string;
  /** A stretch of that block around the first match. */
  snippet: string;
}

/**
 * Lower case, accents and punctuation off, so search forgives the keyboard:
 * "cafe" finds "Café" and "wifi" finds "Wi-Fi". Word gaps stay.
 */
export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .toLowerCase();

/** The folded text, and for each of its characters where it came from in the original. */
function foldWithMap(text: string): { folded: string; from: number[] } {
  let folded = "";
  const from: number[] = [];
  [...text].forEach((ch, i) => {
    for (const f of fold(ch)) {
      folded += f;
      from.push(i);
    }
  });
  return { folded, from };
}

/** Around the first word found: about `width` characters, cut at spaces, with … where it was cut. */
export function snippetAround(text: string, words: string[], width = 120): string {
  const flat = [...text.replace(/\s+/g, " ").trim()];
  const { folded, from } = foldWithMap(flat.join(""));
  const hits = words.map((w) => folded.indexOf(w)).filter((i) => i >= 0);
  if (!hits.length || flat.length <= width) return flat.slice(0, width).join("");
  const at = from[Math.min(...hits)];
  let start = Math.max(0, at - Math.floor(width / 3));
  if (start > 0) start = flat.indexOf(" ", start) + 1 || start;
  let end = Math.min(flat.length, start + width);
  if (end < flat.length) end = flat.lastIndexOf(" ", end) > start ? flat.lastIndexOf(" ", end) : end;
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).join("")}${end < flat.length ? "…" : ""}`;
}

/**
 * Pages whose title and words hold every word of the query (in any order,
 * across blocks), best first: title matches, then pages where more blocks
 * match. Archived pages are left out.
 */
export function searchPages(pages: Page[], blocks: PageBlock[], query: string, limit = 20): SearchHit[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const byPage = new Map<string, PageBlock[]>();
  for (const b of blocks) byPage.set(b.page_id, [...(byPage.get(b.page_id) ?? []), b]);
  const hits: (SearchHit & { score: number })[] = [];
  for (const page of pages) {
    if (page.archived) continue;
    const title = fold(page.title);
    const texts = (byPage.get(page.id) ?? []).sort((a, b) => a.position - b.position).map((b) => ({ b, t: fold(b.text) }));
    const everywhere = `${title}\n${texts.map((x) => x.t).join("\n")}`;
    if (!words.every((w) => everywhere.includes(w))) continue;
    const titleWords = words.filter((w) => title.includes(w)).length;
    const scored = texts.map((x) => ({ ...x, n: words.filter((w) => x.t.includes(w)).length })).filter((x) => x.n > 0);
    const best = scored.sort((a, b) => b.n - a.n)[0];
    hits.push({
      pageId: page.id,
      title: page.title.trim() || "Untitled",
      emoji: page.emoji,
      blockId: best?.b.id,
      snippet: best ? snippetAround(best.b.text, words) : "",
      score: titleWords * 10 + scored.length,
    });
  }
  return hits
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))
    .slice(0, limit)
    .map((h) => ({ pageId: h.pageId, title: h.title, emoji: h.emoji, blockId: h.blockId, snippet: h.snippet }));
}
