"use client";

import { useEffect, useRef, useState } from "react";
import { InputRule, mergeAttributes, Node } from "@tiptap/core";
import { NodeViewWrapper, ReactNodeViewRenderer, type ReactNodeViewProps } from "@tiptap/react";
import { parseDate } from "@internationalized/date";
import { RiCalendarLine } from "@remixicon/react";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { cx } from "@/utils/cx";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Today in the household's time zone, as YYYY-MM-DD. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/** "20 Nov", or "20 Nov 2027" outside this year. */
export function dateLabel(iso: string, today = todayIso()): string {
  if (!ISO.test(iso)) return iso || "Pick a date";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: iso.slice(0, 4) === today.slice(0, 4) ? undefined : "numeric", timeZone: "UTC" });
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    dateChip: {
      /** Inserts a date (today by default) and opens its picker. */
      insertDate: (value?: string) => ReturnType;
    };
  }
}

interface DateChipStorage {
  /** When a chip was last inserted; a chip drawn within moments of it opens its picker. */
  insertedAt: number;
}

/**
 * Whether the chip being drawn was just inserted, so should open its picker.
 * A time window rather than a flag that's cleared: React runs effects twice
 * in development, and a cleared flag would be gone by the second run.
 */
function justInserted(editor: ReactNodeViewProps["editor"]): boolean {
  const storage = (editor.storage as unknown as { dateChip: DateChipStorage }).dateChip;
  return editor.isEditable && Date.now() - storage.insertedAt < 600;
}

function DateChipView({ node, updateAttributes, editor, selected }: ReactNodeViewProps) {
  const value = String(node.attrs.value ?? "");
  const [open, setOpen] = useState(false);
  const chip = useRef<HTMLButtonElement>(null);

  // A chip made a moment ago with // or /date opens its picker once.
  useEffect(() => {
    if (!justInserted(editor)) return;
    const id = window.setTimeout(() => setOpen(true), 0);
    return () => window.clearTimeout(id);
  }, [editor]);

  let calendarValue = null;
  try {
    calendarValue = ISO.test(value) ? parseDate(value) : null;
  } catch {
    calendarValue = null;
  }
  const overdue = ISO.test(value) && value < todayIso();

  return (
    <NodeViewWrapper as="span" className="date-chip-wrap">
      <button
        ref={chip}
        type="button"
        contentEditable={false}
        disabled={!editor.isEditable}
        aria-label={`Date: ${dateLabel(value)}${editor.isEditable ? ". Change date" : ""}`}
        onClick={() => editor.isEditable && setOpen(true)}
        className={cx(
          "date-chip inline-flex cursor-pointer items-center gap-1 rounded-md px-1.5 align-baseline text-body-medium outline-none transition-shadow hover:ring-1 hover:ring-inset hover:ring-current disabled:cursor-text disabled:hover:ring-0",
          "focus-visible:ring-2 focus-visible:ring-border-focus-ring",
          // Green while it's ahead (today included), red once it has passed.
          overdue ? "bg-chip-overdue-background text-chip-overdue-foreground" : "bg-chip-date-background text-chip-date-foreground",
          selected && "ring-2 ring-border-focus-ring",
        )}
      >
        <RiCalendarLine className="size-3.5 shrink-0 opacity-70" aria-hidden />
        <time dateTime={value}>{dateLabel(value)}</time>
      </button>
      {editor.isEditable ? (
        <DatePicker
          aria-label="Change date"
          triggerRef={chip}
          isOpen={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) editor.commands.focus();
          }}
          value={calendarValue}
          onChange={(d) => d && updateAttributes({ value: d.toString() })}
        />
      ) : null}
    </NodeViewWrapper>
  );
}

/**
 * A date in the text, shown as a chip and stored as YYYY-MM-DD (so the
 * sheet's plain copy reads as a date). Type // or pick Date from the / menu.
 */
export const DateChip = Node.create<object, DateChipStorage>({
  name: "dateChip",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addStorage: () => ({ insertedAt: 0 }),

  addAttributes() {
    return {
      value: {
        default: "",
        parseHTML: (el) => el.getAttribute("datetime") ?? "",
        renderHTML: (attrs) => ({ datetime: attrs.value }),
      },
    };
  },

  parseHTML: () => [{ tag: "time[data-date-chip]" }],
  renderHTML: ({ HTMLAttributes, node }) => ["time", mergeAttributes(HTMLAttributes, { "data-date-chip": "" }), dateLabel(String(node.attrs.value ?? ""))],
  renderText: ({ node }) => String(node.attrs.value ?? ""),

  addNodeView() {
    return ReactNodeViewRenderer(DateChipView, { as: "span" });
  },

  addCommands() {
    return {
      insertDate:
        (value) =>
        ({ chain }) => {
          this.storage.insertedAt = Date.now();
          return chain()
            .insertContent([{ type: this.name, attrs: { value: value ?? todayIso() } }, { type: "text", text: " " }])
            .run();
        },
    };
  },

  addInputRules() {
    return [
      new InputRule({
        // "//" at the start or after a space, like Confluence.
        find: /(?:^|\s)(\/\/)$/,
        handler: ({ range, chain, match }) => {
          const start = range.from + (match[0].length - 2);
          this.storage.insertedAt = Date.now();
          chain()
            .deleteRange({ from: start, to: range.to })
            .insertContentAt(start, [{ type: this.name, attrs: { value: todayIso() } }, { type: "text", text: " " }])
            .run();
        },
      }),
    ];
  },
});
