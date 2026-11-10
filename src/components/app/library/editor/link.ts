import { Extension, getMarkRange, type Editor } from "@tiptap/core";

/** What the link popover edits: the words shown and where they go. */
export interface LinkDraft {
  from: number;
  to: number;
  text: string;
  href: string;
  /** True when the cursor was on an existing link. */
  existing: boolean;
}

/** The link under the cursor, else the selected words, else an empty link at the cursor. */
export function linkDraftAt(editor: Editor): LinkDraft {
  const { state } = editor;
  const { from, to, $from } = state.selection;
  const type = state.schema.marks.link;
  const range = type ? getMarkRange($from, type) : undefined;
  if (range && editor.isActive("link")) {
    return { ...range, text: state.doc.textBetween(range.from, range.to), href: String(editor.getAttributes("link").href ?? ""), existing: true };
  }
  return { from, to, text: state.doc.textBetween(from, to, " "), href: "", existing: false };
}

const SCHEMES = /^(https?:|mailto:|tel:)/i;

/**
 * A typed address as a safe href: "pln.co.id" gets https://, an email gets
 * mailto:, and anything with another scheme (javascript:, data:) is refused.
 */
export function normalizeHref(input: string): string | null {
  const v = input.trim();
  if (!v) return null;
  if (SCHEMES.test(v)) return v;
  if (/^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[^:]+:\d/.test(v)) return null;
  if (/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(v)) return `mailto:${v}`;
  if (v.startsWith("/") || v.startsWith("#")) return v;
  return `https://${v}`;
}

/**
 * Writes the draft back: the words become a link to `href`. Unchanged words
 * keep their other formatting; changed or new words are replaced.
 */
export function applyLink(editor: Editor, draft: LinkDraft, text: string, href: string) {
  const words = text.trim() ? text : href;
  const chain = editor.chain().focus();
  if (draft.from !== draft.to && words === draft.text) {
    chain.setTextSelection({ from: draft.from, to: draft.to }).extendMarkRange("link").setLink({ href }).setTextSelection(draft.to).run();
    return;
  }
  chain
    .insertContentAt({ from: draft.from, to: draft.to }, { type: "text", text: words, marks: [{ type: "link", attrs: { href } }] })
    .setTextSelection(draft.from + words.length)
    // Typing on after the link shouldn't extend it.
    .unsetMark("link")
    .run();
}

export function removeLink(editor: Editor, draft: LinkDraft) {
  editor.chain().focus().setTextSelection({ from: draft.from, to: draft.to }).unsetLink().setTextSelection(draft.to).run();
}

/** ⌘K / Ctrl+K opens the link popover. */
export const LinkShortcut = Extension.create<{ open: () => void }>({
  name: "linkShortcut",
  addOptions: () => ({ open: () => {} }),
  addKeyboardShortcuts() {
    return {
      "Mod-k": () => {
        this.options.open();
        return true;
      },
    };
  },
});
