"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Extension, type Editor } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { RiChat3Line } from "@remixicon/react";
import { cx } from "@/utils/cx";
import { useOverlayRoot } from "./overlay-root";

interface MarksState {
  /** Blocks with open threads. */
  ids: ReadonlySet<string>;
  /** The block whose comments are open. */
  active: string | null;
  /** Blocks someone else reworded while this person was editing them. */
  conflicts: ReadonlySet<string>;
}

const key = new PluginKey<MarksState>("commentMarks");

/**
 * Tints blocks that have open comments, and the one whose comments are being
 * read, with node decorations: nothing is written into the document.
 */
export const CommentMarks = Extension.create({
  name: "commentMarks",
  addProseMirrorPlugins() {
    return [
      new Plugin<MarksState>({
        key,
        state: {
          init: () => ({ ids: new Set(), active: null, conflicts: new Set() }),
          apply: (tr, value) => (tr.getMeta(key) as MarksState | undefined) ?? value,
        },
        props: {
          decorations(state) {
            const { ids, active, conflicts } = key.getState(state)!;
            if (!ids.size && !active && !conflicts.size) return null;
            const decos: Decoration[] = [];
            state.doc.descendants((node, pos) => {
              const id = node.attrs.id as string | undefined;
              if (!id) return;
              const cls = conflicts.has(id) ? "has-conflict" : id === active ? "comment-active" : ids.has(id) ? "has-comments" : null;
              if (cls) decos.push(Decoration.node(pos, pos + node.nodeSize, { class: cls }));
            });
            return DecorationSet.create(state.doc, decos);
          },
        },
      }),
    ];
  },
});

export function setCommentMarks(editor: Editor, ids: ReadonlySet<string>, active: string | null, conflicts: ReadonlySet<string> = new Set()) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(key, { ids, active, conflicts }).setMeta("addToHistory", false));
}

/** A block's words by id, with spaces between its paragraphs and list items. */
export function blockText(editor: Editor, id: string): string {
  let out = "";
  editor.state.doc.descendants((node, pos) => {
    if (out) return false;
    if (node.attrs.id === id) {
      out = editor.state.doc.textBetween(pos, pos + node.nodeSize, " ", " ");
      return false;
    }
    return true;
  });
  return out;
}

/** The id and words of the block holding the cursor (the innermost one with an id). */
export function blockAtSelection(editor: Editor): { id: string; text: string } | null {
  const { $from, from, to, empty } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    const id = node.attrs.id as string | undefined;
    if (id) return { id, text: empty ? blockText(editor, id) : editor.state.doc.textBetween(from, to, " ") };
  }
  return null;
}

/** A count beside each block with open threads; pressing it opens them. */
export function CommentMarkers({ editor, counts, onOpen }: { editor: Editor; counts: ReadonlyMap<string, number>; onOpen: (id: string) => void }) {
  const host = editor.view.dom.parentElement;
  const overlay = useOverlayRoot(host);
  const [spots, setSpots] = useState<{ id: string; top: number; count: number }[]>([]);

  useEffect(() => {
    if (!host) return;
    const measure = () => {
      const base = host.getBoundingClientRect().top;
      const out: { id: string; top: number; count: number }[] = [];
      for (const [id, count] of counts) {
        const el = host.querySelector<HTMLElement>(`[data-id="${CSS.escape(id)}"]`);
        if (el) out.push({ id, count, top: el.getBoundingClientRect().top - base });
      }
      setSpots(out);
    };
    // Fires once on observe, then whenever the page's height changes (typing, images, width).
    const ro = new ResizeObserver(measure);
    ro.observe(editor.view.dom);
    editor.on("update", measure);
    return () => {
      ro.disconnect();
      editor.off("update", measure);
    };
  }, [counts, editor, host]);

  if (!host || !overlay) return null;
  return createPortal(
    <>
      {spots.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onOpen(s.id)}
          aria-label={`${s.count} comment${s.count === 1 ? "" : "s"} on this block`}
          style={{ top: s.top }}
          className={cx(
            "absolute -end-1 z-10 flex h-6 cursor-pointer items-center gap-0.5 rounded-full border border-separator-border bg-background-primary-default px-1.5 text-caption-1-medium text-text-secondary shadow-xs outline-none xl:-end-11",
            "hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          )}
        >
          <RiChat3Line className="size-3.5" aria-hidden />
          {s.count}
        </button>
      ))}
    </>,
    overlay,
  );
}
