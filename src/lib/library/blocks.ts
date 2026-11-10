import { STEP } from "@/lib/lists/order";
import type { PageBlock } from "@/lib/sheets/schema";

/** A node of the editor's document, as ProseMirror serialises it. */
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: { type: string; attrs?: Record<string, unknown> }[];
}

/** What a page's blocks look like on the wire: one top-level node each, its JSON already stringified. */
export interface BlockInput {
  id: string;
  type: string;
  position: number;
  json: string;
}

/** A cell holds at most 50,000 characters; leave room for the sheet's own escaping. */
export const CELL_CHARS = 45_000;
const JSON_COLUMNS = ["json", "json_2", "json_3", "json_4"] as const;
/** The longest node a block row can hold. */
export const MAX_BLOCK_CHARS = CELL_CHARS * JSON_COLUMNS.length;

type JsonCells = Pick<PageBlock, (typeof JSON_COLUMNS)[number]>;

/** A node's JSON spread over the row's json columns. Throws when it doesn't fit. */
export function splitJson(json: string): JsonCells {
  if (json.length > MAX_BLOCK_CHARS) throw new Error("This block is too long to save. Split it into smaller ones.");
  const out = {} as JsonCells;
  JSON_COLUMNS.forEach((col, i) => (out[col] = json.slice(i * CELL_CHARS, (i + 1) * CELL_CHARS)));
  return out;
}

export const joinJson = (row: JsonCells) => JSON_COLUMNS.map((c) => row[c]).join("");

/** Block-level nodes whose children go on their own lines in the plain-text copy. */
const INLINE_PARENTS = new Set(["paragraph", "heading", "codeBlock"]);

/** The node's words, one line per paragraph, for the sheet's `text` column and search. */
export function nodeText(node: DocNode): string {
  if (node.type === "text") return node.text ?? "";
  if (node.type === "hardBreak") return "\n";
  if (node.type === "mention") return `@${String(node.attrs?.label ?? "")}`;
  if (node.type === "dateChip") return String(node.attrs?.value ?? "");
  const kids = node.content ?? [];
  if (INLINE_PARENTS.has(node.type)) return kids.map(nodeText).join("");
  // A table row reads as one line, its cells apart by a tab, so the sheet copy keeps the grid.
  if (node.type === "tableRow") return kids.map((c) => nodeText(c).replace(/\n/g, " ")).join("\t");
  return kids
    .map(nodeText)
    .filter((t) => t !== "")
    .join("\n");
}

const paragraph = (id: string, text: string): DocNode => ({
  type: "paragraph",
  attrs: { id },
  ...(text ? { content: [{ type: "text", text }] } : {}),
});

/** The editor node for a stored row. A row typed into the sheet by hand (text only) becomes paragraphs. */
export function rowNode(row: PageBlock): DocNode[] {
  const json = joinJson(row);
  if (json) {
    try {
      const node = JSON.parse(json) as DocNode;
      if (node && typeof node.type === "string") return [{ ...node, attrs: { ...node.attrs, id: row.id } }];
    } catch {
      // Damaged JSON: fall back to the plain copy below rather than losing the words.
    }
  }
  const lines = row.text.split("\n");
  return lines.map((line, i) => paragraph(i === 0 ? row.id : `${row.id}-${i}`, line));
}

export const byPosition = <T extends { position: number; id: string }>(a: T, b: T) => a.position - b.position || a.id.localeCompare(b.id);

/** A page's document from its rows, in order. An empty page gets one empty paragraph. */
export function docFromRows(rows: PageBlock[]): DocNode {
  const content = [...rows].sort(byPosition).flatMap(rowNode);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

/** Indices of a longest strictly increasing run in `values` (undefined never joins it). */
function longestIncreasing(values: (number | undefined)[]): Set<number> {
  const tails: number[] = []; // index into values of the smallest tail for each run length
  const prev = new Array<number>(values.length).fill(-1);
  values.forEach((v, i) => {
    if (v === undefined) return;
    let lo = 0;
    let hi = tails.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (values[tails[mid]]! < v) lo = mid + 1;
      else hi = mid;
    }
    prev[i] = lo > 0 ? tails[lo - 1] : -1;
    tails[lo] = i;
  });
  const keep = new Set<number>();
  for (let i = tails.length ? tails[tails.length - 1] : -1; i !== -1; i = prev[i]) keep.add(i);
  return keep;
}

/**
 * Positions for blocks in the order shown. As many blocks as possible keep
 * the position they had (so a move or an insert rewrites few rows); the rest
 * are spaced between their kept neighbours.
 */
export function assignPositions(order: string[], previous: ReadonlyMap<string, number>): Map<string, number> {
  const old = order.map((id) => previous.get(id));
  const keep = longestIncreasing(old);
  const out = new Map<string, number>();
  let i = 0;
  while (i < order.length) {
    if (keep.has(i)) {
      out.set(order[i], old[i]!);
      i++;
      continue;
    }
    // A run of blocks to place between the kept positions either side.
    let j = i;
    while (j < order.length && !keep.has(j)) j++;
    const before = i > 0 ? out.get(order[i - 1]) : undefined;
    const after = j < order.length ? old[j] : undefined;
    const count = j - i;
    for (let k = 0; k < count; k++) {
      const position =
        before === undefined && after === undefined
          ? (k + 1) * STEP
          : before === undefined
            ? after! - (count - k) * STEP
            : after === undefined
              ? before + (k + 1) * STEP
              : before + ((after - before) * (k + 1)) / (count + 1);
      out.set(order[i + k], position);
    }
    i = j;
  }
  return out;
}

export interface BlockChanges {
  upserts: BlockInput[];
  removes: string[];
}

/**
 * What changed between the blocks the server last confirmed and the document
 * now: new or edited nodes, moved ones and deleted ones. Nodes without an id
 * yet (the editor adds them) are skipped until it has.
 */
export function diffBlocks(saved: ReadonlyMap<string, { position: number; json: string }>, doc: DocNode): BlockChanges {
  const nodes = (doc.content ?? []).filter((n) => typeof n.attrs?.id === "string" && n.attrs.id);
  const ids = nodes.map((n) => n.attrs!.id as string);
  const positions = assignPositions(ids, new Map([...saved].map(([id, b]) => [id, b.position])));
  const upserts: BlockInput[] = [];
  nodes.forEach((node, i) => {
    const id = ids[i];
    const json = JSON.stringify(node);
    const position = positions.get(id)!;
    const before = saved.get(id);
    if (!before || before.json !== json || before.position !== position) upserts.push({ id, type: node.type, position, json });
  });
  const present = new Set(ids);
  const removes = [...saved.keys()].filter((id) => !present.has(id));
  return { upserts, removes };
}

/** What the client remembers of each saved block, to diff against next time. */
export function savedMap(rows: PageBlock[]): Map<string, { position: number; json: string }> {
  const out = new Map<string, { position: number; json: string }>();
  for (const row of rows) {
    // A hand-typed row (text only) never matches, so the next save rewrites it as proper blocks.
    out.set(row.id, { position: row.position, json: joinJson(row) ? JSON.stringify(rowNode(row)[0]) : "" });
  }
  return out;
}

/** The ids of people @mentioned anywhere in a node, each once. */
export function mentionIds(node: DocNode): string[] {
  const out = new Set<string>();
  const walk = (n: DocNode) => {
    if (n.type === "mention" && typeof n.attrs?.id === "string" && n.attrs.id) out.add(n.attrs.id);
    n.content?.forEach(walk);
  };
  walk(node);
  return [...out];
}
