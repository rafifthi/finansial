import type { Node as PMNode } from "@tiptap/pm/model";

/**
 * Live cursors: each person's caret is sent as a spot inside a top-level
 * block (its id and how far into it), not as a document position, because
 * two editors' documents differ until the next save lands.
 */
export type LiveSpot = { block: string; offset: number };
export type LivePresence = { head: LiveSpot | null; anchor: LiveSpot | null; typing: boolean };
export type LiveEvent = { type: "saved"; version: number; by: string };

/** Someone else on the page: `key` is per tab, so one person in two tabs shows twice. */
export interface Peer {
  key: string;
  userId: string;
  name: string;
  presence: LivePresence;
}

export const NOBODY: LivePresence = { head: null, anchor: null, typing: false };

export const liveRoom = (bookId: string, pageId: string) => `finansial:library:${bookId}:${pageId}`;

/** A steady colour per person, from the chart ramp. */
export function colorOf(userId: string): string {
  let h = 0;
  for (const ch of userId) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return `var(--color-chart-${(Math.abs(h) % 5) + 1}-active)`;
}

/** Where `pos` sits, as a block id and an offset into that block. */
export function spotAt(doc: PMNode, pos: number): LiveSpot | null {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
  if ($pos.depth < 1) return null;
  const id = $pos.node(1).attrs.id;
  return typeof id === "string" ? { block: id, offset: pos - $pos.before(1) } : null;
}

/** The position a spot points at in this document, kept inside its block; null when the block isn't here (yet). */
export function posOf(doc: PMNode, spot: LiveSpot): number | null {
  let out: number | null = null;
  doc.forEach((node, pos) => {
    if (out === null && node.attrs.id === spot.block) out = pos + Math.max(1, Math.min(spot.offset, node.nodeSize - 1));
  });
  return out;
}

/** A block's words, with the document position of each character. */
function chars(node: PMNode, start: number): { text: string; at: number[] } {
  let text = "";
  const at: number[] = [];
  node.descendants((n, p) => {
    if (!n.isText || !n.text) return;
    for (let i = 0; i < n.text.length; i++) at.push(start + 1 + p + i);
    text += n.text;
  });
  return { text, at };
}

const MAX_TYPED = 400;

/**
 * The characters in `after` that weren't in `before`, block by block, in
 * page order: what someone else typed, to play back as typing. Only the
 * stretch between the unchanged start and end of each block counts.
 */
export function typedChars(before: PMNode, after: PMNode): number[] {
  const old = new Map<string, string>();
  before.forEach((n, p) => {
    if (typeof n.attrs.id === "string") old.set(n.attrs.id, chars(n, p).text);
  });
  const out: number[] = [];
  after.forEach((n, p) => {
    if (out.length >= MAX_TYPED || typeof n.attrs.id !== "string") return;
    const now = chars(n, p);
    const was = old.get(n.attrs.id) ?? "";
    if (now.text === was) return;
    let start = 0;
    while (start < now.text.length && start < was.length && now.text[start] === was[start]) start++;
    let end = 0;
    while (end < now.text.length - start && end < was.length - start && now.text[now.text.length - 1 - end] === was[was.length - 1 - end]) end++;
    out.push(...now.at.slice(start, now.text.length - end));
  });
  return out.slice(0, MAX_TYPED);
}
