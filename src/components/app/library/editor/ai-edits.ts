import type {} from "@tiptap/markdown";
import type { Editor, JSONContent } from "@tiptap/core";
import type { AssistBlock, AssistChange } from "@/lib/ai/library-assist";

/** The page as the assistant reads it: each top-level block (with its id) as Markdown. */
export function pageAsMarkdown(editor: Editor): AssistBlock[] {
  const md = editor.markdown;
  if (!md) return [];
  const out: AssistBlock[] = [];
  for (const node of editor.getJSON().content ?? []) {
    const id = node.attrs?.id;
    if (typeof id !== "string") continue;
    const markdown = md.serialize({ type: "doc", content: [node] }).trim();
    // Empty lines (like the one kept at the end of the page) tell the assistant nothing.
    if (markdown) out.push({ id, markdown });
  }
  return out;
}

/** The top-level blocks the selection touches, and the words selected (if any). */
export function selectionFocus(editor: Editor): { ids: string[]; text: string } {
  const { from, to, empty } = editor.state.selection;
  const ids: string[] = [];
  editor.state.doc.forEach((node, pos) => {
    const end = pos + node.nodeSize;
    if (end > from && pos < to && typeof node.attrs.id === "string") ids.push(node.attrs.id);
    else if (empty && pos <= from && from <= end && typeof node.attrs.id === "string") ids.push(node.attrs.id);
  });
  return { ids, text: empty ? "" : editor.state.doc.textBetween(from, to, " ").slice(0, 4000) };
}

/** Markdown from the assistant as editor blocks. Ids are left off; the editor gives new blocks their own. */
export function markdownBlocks(editor: Editor, markdown: string): JSONContent[] {
  const md = editor.markdown;
  if (!md) return [];
  const strip = (n: JSONContent): JSONContent => ({
    ...n,
    ...(n.attrs ? { attrs: { ...n.attrs, id: null } } : {}),
    ...(n.content ? { content: n.content.map(strip) } : {}),
  });
  return (md.parse(markdown).content ?? []).map(strip).filter((n) => n.type !== "paragraph" || (n.content?.length ?? 0) > 0);
}

/** One proposed change, ready to show: what's there now and what would replace it. */
export interface PreviewChange {
  key: string;
  change: AssistChange;
  before: JSONContent[];
  after: JSONContent[];
}

export function previewChanges(editor: Editor, changes: AssistChange[]): PreviewChange[] {
  const byId = new Map<string, JSONContent>();
  for (const n of editor.getJSON().content ?? []) if (typeof n.attrs?.id === "string") byId.set(n.attrs.id, n);
  return changes.map((change, i) => ({
    key: `${i}-${change.op}`,
    change,
    before: change.op === "insert_after" ? [] : [byId.get(change.id)].filter((n): n is JSONContent => Boolean(n)),
    after: change.op === "delete" ? [] : markdownBlocks(editor, change.markdown),
  }));
}

/** Where a top-level block with this id sits now. */
function locate(doc: Editor["state"]["doc"], id: string): { from: number; to: number } | null {
  let found: { from: number; to: number } | null = null;
  doc.forEach((node, pos) => {
    if (!found && node.attrs.id === id) found = { from: pos, to: pos + node.nodeSize };
  });
  return found;
}

/**
 * Applies the chosen changes as one step, so a single ⌘Z takes it all back.
 * A replaced block keeps its id on its first new block, so comments on it
 * stay attached; it then saves like any other edit.
 */
export function applyChanges(editor: Editor, chosen: PreviewChange[]): number {
  const { schema } = editor;
  const tr = editor.state.tr;
  let applied = 0;
  for (const { change, after } of chosen) {
    const nodes = after.map((json, i) => {
      // The first block of a replacement takes over the old block's id.
      const withId = change.op === "replace" && i === 0 ? { ...json, attrs: { ...json.attrs, id: change.id } } : json;
      return schema.nodeFromJSON(withId);
    });
    if (change.op === "insert_after") {
      const at = change.after ? locate(tr.doc, change.after)?.to : 0;
      if (at === undefined || at === null || !nodes.length) continue;
      tr.insert(at, nodes);
    } else {
      const spot = locate(tr.doc, change.id);
      if (!spot) continue;
      if (change.op === "delete") tr.delete(spot.from, spot.to);
      else if (nodes.length) tr.replaceWith(spot.from, spot.to, nodes);
      else continue;
    }
    applied++;
  }
  if (applied) editor.view.dispatch(tr.scrollIntoView());
  return applied;
}
