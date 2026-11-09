"use client";

import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import { RiDeleteBinLine, RiDeleteColumn, RiDeleteRow, RiInsertColumnLeft, RiInsertColumnRight, RiInsertRowBottom, RiInsertRowTop, RiLayoutTopLine } from "@remixicon/react";
import { BAR, Floating, ToolButton } from "./editor-bubble";

/** The table holding the cursor: where it starts and how far it runs. */
function tableAround(editor: Editor): { from: number; to: number } | null {
  const { $from } = editor.state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (node.type.name === "table") {
      const from = $from.before(d);
      return { from, to: from + node.nodeSize };
    }
  }
  return null;
}

/**
 * Row and column tools under the table the cursor is in (above it would
 * cover the line before). Out of the way while words are selected, when the
 * formatting bar takes over.
 */
export function TableMenu({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      const table = tableAround(e);
      const sel = e.state.selection;
      return {
        table,
        show: Boolean(table) && e.isFocused && (sel.empty || sel instanceof CellSelection),
        header: e.isActive("tableHeader"),
      };
    },
    equalityFn: (a, b) => a?.show === b?.show && a?.header === b?.header && a?.table?.from === b?.table?.from && a?.table?.to === b?.table?.to,
  });
  if (!s?.show || !s.table || !editor.isEditable) return null;
  const run = (name: "addRowBefore" | "addRowAfter" | "addColumnBefore" | "addColumnAfter" | "deleteRow" | "deleteColumn" | "toggleHeaderRow" | "deleteTable") => () => editor.chain().focus()[name]().run();
  return (
    <Floating editor={editor} from={s.table.from} to={s.table.to} label="Table" placement="bottom-start">
      <div className={BAR}>
        <ToolButton icon={RiInsertRowTop} label="Add a row above" onPress={run("addRowBefore")} />
        <ToolButton icon={RiInsertRowBottom} label="Add a row below" onPress={run("addRowAfter")} />
        <ToolButton icon={RiInsertColumnLeft} label="Add a column before" onPress={run("addColumnBefore")} />
        <ToolButton icon={RiInsertColumnRight} label="Add a column after" onPress={run("addColumnAfter")} />
        <span className="mx-0.5 h-4 w-px bg-separator-border" aria-hidden />
        <ToolButton icon={RiLayoutTopLine} label="Header row" active={s.header} onPress={run("toggleHeaderRow")} />
        <span className="mx-0.5 h-4 w-px bg-separator-border" aria-hidden />
        <ToolButton icon={RiDeleteRow} label="Delete row" onPress={run("deleteRow")} />
        <ToolButton icon={RiDeleteColumn} label="Delete column" onPress={run("deleteColumn")} />
        <ToolButton icon={RiDeleteBinLine} label="Delete table" onPress={run("deleteTable")} />
      </div>
    </Floating>
  );
}
