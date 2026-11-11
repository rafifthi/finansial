import { Extension, type Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { colorOf, posOf, typedChars, type Peer } from "@/lib/library/live";

interface LiveState {
  peers: Peer[];
  /** Characters someone else just typed, fading in one after another. */
  typed: DecorationSet;
}

type LiveMeta = { peers: Peer[] } | { typed: DecorationSet };

const key = new PluginKey<LiveState>("liveCursors");

/** The other person's caret: a coloured bar with their name, and dots while they type. */
function caret(peer: Peer): HTMLElement {
  const el = document.createElement("span");
  el.className = "live-caret";
  el.style.setProperty("--live-color", colorOf(peer.userId));
  el.setAttribute("aria-hidden", "true");
  const flag = document.createElement("span");
  flag.className = peer.presence.typing ? "live-flag is-typing" : "live-flag";
  flag.textContent = peer.name;
  if (peer.presence.typing) {
    const dots = document.createElement("span");
    dots.className = "live-dots";
    dots.append(document.createElement("i"), document.createElement("i"), document.createElement("i"));
    flag.append(dots);
  }
  el.append(flag);
  return el;
}

function peerDecorations(doc: PMNode, peers: Peer[]): Decoration[] {
  const out: Decoration[] = [];
  for (const peer of peers) {
    const { head, anchor } = peer.presence;
    if (!head) continue;
    const at = posOf(doc, head);
    if (at === null) continue;
    const from = anchor && anchor.block === head.block ? posOf(doc, anchor) : null;
    if (from !== null && from !== at) {
      out.push(Decoration.inline(Math.min(from, at), Math.max(from, at), { class: "live-selection", style: `--live-color: ${colorOf(peer.userId)}` }));
    }
    // A new key when they move or start typing redraws the caret, so its name shows again for a moment.
    out.push(Decoration.widget(at, () => caret(peer), { key: `${peer.key}:${at}:${peer.presence.typing}`, side: 1, ignoreSelection: true, marks: [] }));
  }
  return out;
}

/** Other people's carets and selections, drawn over the page; nothing is written into it. */
export const LiveCursors = Extension.create({
  name: "liveCursors",
  addProseMirrorPlugins() {
    return [
      new Plugin<LiveState>({
        key,
        state: {
          init: () => ({ peers: [], typed: DecorationSet.empty }),
          apply: (tr, value) => {
            const meta = tr.getMeta(key) as LiveMeta | undefined;
            const typed = meta && "typed" in meta ? meta.typed : value.typed.map(tr.mapping, tr.doc);
            return { peers: meta && "peers" in meta ? meta.peers : value.peers, typed };
          },
        },
        props: {
          decorations(state) {
            const { peers, typed } = key.getState(state)!;
            if (!peers.length) return typed;
            return typed.add(state.doc, peerDecorations(state.doc, peers));
          },
        },
      }),
    ];
  },
});

export function setPeers(editor: Editor, peers: Peer[]) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(key, { peers }).setMeta("addToHistory", false));
}

/**
 * Plays back what arrived from someone else's save as typing: each new
 * character appears a beat after the one before it, in their colour.
 * Returns how long the playback takes.
 */
export function playTyping(editor: Editor, before: PMNode, userId: string): number {
  if (editor.isDestroyed || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return 0;
  const at = typedChars(before, editor.state.doc);
  if (!at.length) return 0;
  const step = Math.max(8, Math.min(45, 1600 / at.length));
  const color = colorOf(userId);
  const decos = at.map((pos, i) =>
    Decoration.inline(pos, pos + 1, { class: "live-typed", style: `--live-color: ${color}; animation-delay: ${Math.round(i * step)}ms` }),
  );
  editor.view.dispatch(editor.state.tr.setMeta(key, { typed: DecorationSet.create(editor.state.doc, decos) }).setMeta("addToHistory", false));
  const total = Math.round(at.length * step) + 700;
  window.setTimeout(() => {
    if (!editor.isDestroyed) editor.view.dispatch(editor.state.tr.setMeta(key, { typed: DecorationSet.empty }).setMeta("addToHistory", false));
  }, total);
  return total;
}
