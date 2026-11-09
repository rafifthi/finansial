import { Extension, type Editor } from "@tiptap/core";

const MAX_INDENT = 6;
const TYPES = ["paragraph", "heading"];

/** Inside a list item, Tab nests the item instead (the list's own shortcut). */
function inList(editor: Editor) {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "listItem" || name === "taskItem") return true;
  }
  return false;
}

function shift(editor: Editor, by: 1 | -1): boolean {
  const { state } = editor;
  const { from, to } = state.selection;
  const tr = state.tr;
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!TYPES.includes(node.type.name)) return true;
    const indent = Math.max(0, Math.min(MAX_INDENT, ((node.attrs.indent as number) ?? 0) + by));
    if (indent !== node.attrs.indent) tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent });
    return false;
  });
  if (!tr.docChanged) return false;
  editor.view.dispatch(tr);
  return true;
}

/**
 * Tab pushes a paragraph or heading in a step, Shift+Tab brings it back
 * (lists nest their items instead; code gets two spaces). Shift+Tab at the
 * left edge does nothing, so keyboard users can still Tab out of the page.
 */
export const Indent = Extension.create({
  name: "indent",

  addGlobalAttributes() {
    return [
      {
        types: TYPES,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => Math.min(MAX_INDENT, Number(el.getAttribute("data-indent")) || 0),
            renderHTML: (attrs) => (attrs.indent ? { "data-indent": attrs.indent, style: `margin-inline-start: ${attrs.indent * 1.5}rem` } : {}),
          },
        },
      },
    ];
  },

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        if (editor.isActive("codeBlock")) return editor.commands.insertContent("  ");
        if (inList(editor)) return false;
        shift(editor, 1);
        // Even at the deepest step, Tab stays in the page rather than jumping to the next control.
        return true;
      },
      "Shift-Tab": ({ editor }) => {
        if (editor.isActive("codeBlock") || inList(editor)) return false;
        return shift(editor, -1);
      },
    };
  },
});
