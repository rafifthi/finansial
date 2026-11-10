import type { Editor, Range } from "@tiptap/core";
import {
  type RemixiconComponentType,
  RiCodeBoxLine,
  RiDoubleQuotesL,
  RiH1,
  RiH2,
  RiH3,
  RiListCheck2,
  RiListOrdered2,
  RiListUnordered,
  RiAtLine,
  RiCalendarLine,
  RiSeparator,
  RiTable2,
  RiText,
} from "@remixicon/react";

/** Where the cursor is, as far as the / menu cares. */
export interface SlashContext {
  inList: boolean;
  inTable: boolean;
}

export interface SlashItem {
  key: string;
  label: string;
  section: "Text" | "Lists" | "Blocks" | "Insert";
  icon: RemixiconComponentType;
  /** Other words that find it: `/h1`, `/todo`, `/ul`. */
  aliases: string[];
  /** Leave the item out where it makes no sense. */
  allowedIn?: (ctx: SlashContext) => boolean;
  /** Applies the block to the line the cursor is on (the menu has already made room). */
  apply: (editor: Editor) => void;
  /** Goes in at the cursor, inside the line, rather than as a block. */
  inline?: boolean;
}

export const SLASH_SECTIONS = ["Text", "Lists", "Blocks", "Insert"] as const;

const notInTable = (ctx: SlashContext) => !ctx.inTable;

export const SLASH_ITEMS: SlashItem[] = [
  { key: "paragraph", label: "Text", section: "Text", icon: RiText, aliases: ["paragraph", "p", "plain"], apply: (e) => void e.chain().setParagraph().run() },
  { key: "h1", label: "Heading 1", section: "Text", icon: RiH1, aliases: ["h1", "title"], allowedIn: notInTable, apply: (e) => void e.chain().setHeading({ level: 1 }).run() },
  { key: "h2", label: "Heading 2", section: "Text", icon: RiH2, aliases: ["h2", "subtitle"], allowedIn: notInTable, apply: (e) => void e.chain().setHeading({ level: 2 }).run() },
  { key: "h3", label: "Heading 3", section: "Text", icon: RiH3, aliases: ["h3"], allowedIn: notInTable, apply: (e) => void e.chain().setHeading({ level: 3 }).run() },
  { key: "bullets", label: "Bulleted list", section: "Lists", icon: RiListUnordered, aliases: ["ul", "bullet", "list"], apply: (e) => void e.chain().toggleBulletList().run() },
  { key: "numbers", label: "Numbered list", section: "Lists", icon: RiListOrdered2, aliases: ["ol", "number", "ordered"], apply: (e) => void e.chain().toggleOrderedList().run() },
  { key: "checklist", label: "Checklist", section: "Lists", icon: RiListCheck2, aliases: ["todo", "task", "check", "checkbox"], apply: (e) => void e.chain().toggleTaskList().run() },
  { key: "quote", label: "Quote", section: "Blocks", icon: RiDoubleQuotesL, aliases: ["blockquote", "callout"], apply: (e) => void e.chain().setBlockquote().run() },
  { key: "code", label: "Code", section: "Blocks", icon: RiCodeBoxLine, aliases: ["codeblock", "pre", "snippet"], allowedIn: (c) => !c.inList, apply: (e) => void e.chain().setCodeBlock().run() },
  { key: "table", label: "Table", section: "Blocks", icon: RiTable2, aliases: ["grid", "columns", "rows"], allowedIn: notInTable, apply: (e) => void e.chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { key: "date", label: "Date", section: "Insert", icon: RiCalendarLine, aliases: ["today", "deadline", "due", "when"], inline: true, apply: (e) => void e.chain().insertDate().run() },
  { key: "mention", label: "Mention someone", section: "Insert", icon: RiAtLine, aliases: ["@", "person", "people", "tag"], inline: true, apply: (e) => void e.chain().insertContent("@").run() },
  { key: "divider", label: "Divider", section: "Blocks", icon: RiSeparator, aliases: ["hr", "line", "separator", "rule"], apply: (e) => void e.chain().setHorizontalRule().run() },
];

/** The cursor's surroundings: inside a list item or a table cell. */
export function slashContext(editor: Editor): SlashContext {
  const { $from } = editor.state.selection;
  let inList = false;
  let inTable = false;
  for (let d = $from.depth; d > 0; d--) {
    const name = $from.node(d).type.name;
    if (name === "listItem" || name === "taskItem") inList = true;
    if (name === "tableCell" || name === "tableHeader") inTable = true;
  }
  return { inList, inTable };
}

/** Items for the typed query: label words first, then aliases, in menu order. */
export function filterSlashItems(query: string, ctx: SlashContext, items: SlashItem[] = SLASH_ITEMS): SlashItem[] {
  const q = query.trim().toLowerCase();
  const allowed = items.filter((i) => !i.allowedIn || i.allowedIn(ctx));
  if (!q) return allowed;
  const byLabel = allowed.filter((i) => i.label.toLowerCase().split(/\s+/).some((w) => w.startsWith(q)) || i.label.toLowerCase().startsWith(q));
  const byAlias = allowed.filter((i) => !byLabel.includes(i) && i.aliases.some((a) => a.startsWith(q)));
  return [...byLabel, ...byAlias];
}

/**
 * Removes the typed `/query`, then turns the line into the chosen block. A
 * line that already has words keeps them and gets the new block below it.
 */
export function runSlashItem(editor: Editor, range: Range, item: SlashItem) {
  editor.chain().focus().deleteRange(range).run();
  const { $from } = editor.state.selection;
  const empty = $from.parent.isTextblock && $from.parent.content.size === 0;
  if (!empty && !item.inline && item.key !== "divider") {
    const after = $from.after();
    editor.chain().insertContentAt(after, { type: "paragraph" }).setTextSelection(after + 1).run();
  }
  item.apply(editor);
  editor.commands.focus();
}
