"use client";

import { useRef, useState } from "react";
import {
  RiCalendarLine,
  RiCalendarScheduleLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiDraggable,
  RiFileTextLine,
  RiMoreLine,
  RiPlayListAddLine,
  RiRepeatLine,
  RiStarFill,
  RiStarLine,
} from "@remixicon/react";
import { Button as AriaButton, DropIndicator, GridList, GridListItem, useDragAndDrop } from "react-aria-components";
import { Checkbox } from "@/components/base/checkbox/checkbox";
import { Dropdown, DropdownDivider, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { deadlineLabel, PRIORITY_LABELS, REPEAT_LABELS, type DeadlineTone } from "@/lib/lists/order";
import type { TodoItem, TodoList } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import type { ItemPatch } from "@/actions/lists";
import { CategoryIcon } from "../category-icon";
import { draftOf, ItemComposer, ItemFields, PRIORITY_MARK, type Draft } from "./item-fields";
import type { ItemDraft } from "./use-lists";

export interface RowActions {
  canEdit: boolean;
  today: string;
  /** Every list, for moving an item from its menu. */
  lists: TodoList[];
  /** The item open for editing, and whether its calendar opens with it. */
  editing: { id: string; picker: boolean } | null;
  setEditing: (editing: { id: string; picker: boolean } | null) => void;
  /** The item a blank row is open under (after Enter). */
  insertAfter: string | null;
  setInsertAfter: (id: string | null) => void;
  /** Adds items right under `anchor`. */
  onAddBelow: (anchor: TodoItem, drafts: ItemDraft[]) => void;
  onPatch: (id: string, patch: ItemPatch) => void;
  onToggle: (item: TodoItem) => void;
  onDelete: (item: TodoItem) => void;
  onMove: (item: TodoItem, listId: string) => void;
  /** "New list" in the item menu: creates a list and moves the item into it. */
  onNewList: (item: TodoItem) => void;
}

const TONE: Record<DeadlineTone, string> = {
  overdue: "text-text-error-primary",
  today: "text-button-ghost-foreground",
  soon: "text-text-secondary",
  later: "text-text-tertiary",
};

/**
 * Items as a React Aria grid: arrow keys move between rows, and in a
 * manually sorted list each row has a drag handle (Enter on it, then arrow
 * keys, reorders from the keyboard).
 */
export function ItemsGrid({
  label,
  items,
  actions,
  listsById,
  onReorder,
  canInsert,
}: {
  label: string;
  items: TodoItem[];
  actions: RowActions;
  /** Shown in smart views, where items come from several lists. */
  listsById?: Map<string, TodoList>;
  /** Set when the order can be changed by dragging: the moved id and its new index. */
  onReorder?: (id: string, index: number) => void;
  /** Enter on an item opens a blank row under it (an ordinary list's to-do items). */
  canInsert?: boolean;
}) {
  const reorderable = Boolean(onReorder) && actions.canEdit && items.length > 1;
  // No dragging while something is being typed: selecting text would start a drag.
  const draggable = reorderable && !actions.editing && !actions.insertAfter;
  // Always handed to the grid and switched off with isDisabled: swapping the hooks in and out breaks the grid's hook order.
  const { dragAndDropHooks } = useDragAndDrop({
    isDisabled: !draggable,
    getItems: (keys) => [...keys].map((key) => ({ "text/plain": items.find((i) => i.id === key)?.title ?? String(key) })),
    onReorder(e) {
      const id = String([...e.keys][0]);
      const rest = items.filter((i) => i.id !== id);
      const at = rest.findIndex((i) => i.id === e.target.key);
      onReorder?.(id, e.target.dropPosition === "before" ? at : at + 1);
    },
    renderDropIndicator: (target) => (
      <DropIndicator target={target} className={({ isDropTarget }) => cx("-my-px h-0.5 rounded-full", isDropTarget ? "bg-button-ghost-foreground" : "bg-transparent")} />
    ),
  });
  return (
    <GridList
      aria-label={label}
      items={items}
      dependencies={[actions]}
      dragAndDropHooks={dragAndDropHooks}
      // Row content is mostly controls; keep Tab moving through them.
      keyboardNavigationBehavior="tab"
      className="flex flex-col outline-none"
    >
      {(item) => (
        <ItemRow item={item} actions={actions} list={listsById?.get(item.list_id)} draggable={draggable} handleRoom={reorderable} canInsert={Boolean(canInsert)} />
      )}
    </GridList>
  );
}

function ItemRow({
  item,
  actions,
  list,
  draggable,
  handleRoom,
  canInsert,
}: {
  item: TodoItem;
  actions: RowActions;
  list?: TodoList;
  draggable: boolean;
  /** Phones keep the handle's room while it's hidden for editing, so rows don't jump. */
  handleRoom: boolean;
  canInsert: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { canEdit, today, editing, setEditing, insertAfter, setInsertAfter, onToggle } = actions;
  const isEditing = editing?.id === item.id;
  const deadline = item.deadline ? deadlineLabel(item.deadline, today) : null;
  const priority = PRIORITY_MARK[item.priority];
  const edit = () => {
    if (canEdit) setEditing({ id: item.id, picker: false });
  };

  return (
    <GridListItem
      id={item.id}
      textValue={item.title}
      className={({ isDragging, isFocusVisible }) =>
        cx("group/row relative flex flex-col rounded-xl outline-none", isDragging && "opacity-50", isFocusVisible && "ring-2 ring-border-focus-ring")
      }
    >
      <div
        className={cx(
          "relative flex items-start gap-2 rounded-xl px-1.5 py-1.5 transition-colors sm:gap-3 sm:px-2",
          isEditing ? "bg-background-secondary-default" : "hover:bg-background-secondary-hover",
          menuOpen && "bg-background-secondary-hover",
        )}
        // Right-click opens the same menu as the ⋯ button.
        onContextMenu={(e) => {
          if (!canEdit || isEditing) return;
          e.preventDefault();
          setMenuOpen(true);
        }}
      >
        {draggable ? (
          <AriaButton
            slot="drag"
            aria-label={`Move ${item.title}`}
            // Desktop: hangs in the panel's gutter, so checkboxes line up with the add row. Phones: in the row, thumb-sized.
            className="-ms-1 flex size-6 shrink-0 cursor-grab items-center justify-center self-center rounded-md text-foreground-icon-quaternary outline-none hover:text-foreground-icon-secondary focus-visible:ring-2 focus-visible:ring-border-focus-ring active:cursor-grabbing max-sm:size-9 sm:absolute sm:-start-5 sm:top-1/2 sm:ms-0 sm:-translate-y-1/2 sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100"
          >
            <RiDraggable className="size-4" aria-hidden />
          </AriaButton>
        ) : handleRoom ? (
          <span className="-ms-1 w-9 shrink-0 sm:hidden" aria-hidden />
        ) : null}

        {/* Padding gives the 16px box a 32px target without moving it. */}
        <Checkbox
          slot={null}
          aria-label={item.done ? `Mark ${item.title} as not done` : `Mark ${item.title} as done`}
          isSelected={item.done}
          isDisabled={!canEdit}
          onChange={() => onToggle(item)}
          className="-mx-2 -mb-2 -mt-1.5 shrink-0 p-2"
        />

        {isEditing ? (
          <RowEditor item={item} actions={actions} startWithPicker={editing.picker} onEnter={canInsert ? () => setInsertAfter(item.id) : undefined} />
        ) : (
          <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-px">
            <button
              type="button"
              disabled={!canEdit}
              onClick={edit}
              className={cx(
                "-mx-1 rounded-md px-1 text-start text-body-regular outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default",
                canEdit && "cursor-text",
                item.done ? "text-text-tertiary line-through" : "text-text-primary",
              )}
            >
              {priority.mark ? (
                <span className={cx("me-1 text-body-medium", priority.className)}>
                  {priority.mark}
                  <span className="sr-only"> {PRIORITY_LABELS[item.priority]} priority:</span>
                </span>
              ) : null}
              <span className="break-words">{item.title}</span>
            </button>

            {deadline || item.repeat || item.note || list ? (
              <button
                type="button"
                disabled={!canEdit}
                onClick={edit}
                className="-mx-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 rounded-md px-1 text-start text-caption-1-medium text-text-tertiary outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default"
              >
                {list ? (
                  <span className="flex min-w-0 items-center gap-1">
                    <CategoryIcon name={list.name} emoji={list.emoji} color={list.color} size="sm" />
                    <span className="truncate">{list.name}</span>
                  </span>
                ) : null}
                {deadline ? (
                  <span className={cx("flex items-center gap-1", item.done ? "text-text-tertiary" : TONE[deadline.tone])}>
                    <RiCalendarLine className="size-3.5" aria-hidden />
                    {deadline.tone === "overdue" && !item.done ? <span className="sr-only">Overdue,</span> : null}
                    {deadline.label}
                  </span>
                ) : null}
                {item.repeat ? (
                  <span className="flex items-center gap-1">
                    <RiRepeatLine className="size-3.5" aria-hidden />
                    {REPEAT_LABELS[item.repeat]}
                  </span>
                ) : null}
                {item.note ? (
                  <span className="flex min-w-0 items-center gap-1">
                    <RiFileTextLine className="size-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{item.note}</span>
                  </span>
                ) : null}
              </button>
            ) : null}
          </div>
        )}

        {canEdit || item.starred ? (
          <button
            type="button"
            aria-label={item.starred ? `Unstar ${item.title}` : `Star ${item.title}`}
            aria-pressed={item.starred}
            disabled={!canEdit}
            onClick={() => actions.onPatch(item.id, { starred: !item.starred })}
            className={cx(
              "flex size-7 shrink-0 cursor-pointer items-center justify-center rounded-lg outline-none transition-[color,opacity] hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring disabled:cursor-default max-sm:size-9",
              item.starred
                ? "text-chart-8"
                : isEditing
                  ? "text-foreground-icon-tertiary hover:text-foreground-icon-secondary"
                  : // Phones star from the editor, which keeps resting rows to one control on the right.
                    "text-foreground-icon-quaternary hover:text-foreground-icon-secondary max-sm:hidden sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100",
            )}
          >
            {item.starred ? <RiStarFill className="size-4" aria-hidden /> : <RiStarLine className="size-4" aria-hidden />}
          </button>
        ) : null}

        {canEdit && !isEditing ? <RowMenu item={item} actions={actions} open={menuOpen} onOpenChange={setMenuOpen} /> : null}
      </div>

      {insertAfter === item.id ? (
        <ItemComposer
          below
          listName={list?.name ?? "this list"}
          today={today}
          indent={handleRoom}
          onAdd={(drafts) => actions.onAddBelow(item, drafts)}
          onClose={() => setInsertAfter(null)}
        />
      ) : null}
    </GridListItem>
  );
}

/** An item open for editing: the same fields as the add row, saved on Enter or when focus leaves. */
function RowEditor({ item, actions, startWithPicker, onEnter }: { item: TodoItem; actions: RowActions; startWithPicker: boolean; onEnter?: () => void }) {
  const [draft, setDraft] = useState<Draft>(() => draftOf(item));
  const titleRef = useRef<HTMLInputElement | null>(null);
  const closed = useRef(false);

  const commit = (save: boolean) => {
    if (closed.current) return;
    closed.current = true;
    if (save) {
      // An emptied title keeps the old one rather than leaving a blank row.
      const next: Draft = { ...draft, title: draft.title.trim() || item.title, note: draft.note.trim() };
      const patch: ItemPatch = {};
      for (const key of Object.keys(next) as (keyof Draft)[]) if (next[key] !== item[key]) Object.assign(patch, { [key]: next[key] });
      if (Object.keys(patch).length) actions.onPatch(item.id, patch);
    }
    actions.setEditing(null);
  };

  return (
    <ItemFields
      draft={draft}
      onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
      today={actions.today}
      titleRef={titleRef}
      titleLabel="Item"
      expanded
      autoFocus
      startWithPicker={startWithPicker}
      doneStyle={item.done}
      onEnter={() => {
        commit(true);
        onEnter?.();
      }}
      onEscape={() => commit(false)}
      onLeave={() => commit(true)}
    />
  );
}

/** The item menu, after Google Tasks: deadline, delete, then which list it's in. */
function RowMenu({ item, actions, open, onOpenChange }: { item: TodoItem; actions: RowActions; open: boolean; onOpenChange: (open: boolean) => void }) {
  const act = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  return (
    <Dropdown isOpen={open} onOpenChange={onOpenChange}>
      <DropdownTrigger
        aria-label={`More for ${item.title}`}
        className={cx(
          "flex size-7 shrink-0 items-center justify-center rounded-lg text-foreground-icon-tertiary transition-opacity hover:bg-background-secondary-hover hover:text-foreground-icon-primary max-sm:size-9",
          !open && "sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-visible:opacity-100",
        )}
      >
        <RiMoreLine className="size-4" aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label={`Options for ${item.title}`} placement="bottom end" className="w-56">
        <DropdownItem onSelect={act(() => actions.setEditing({ id: item.id, picker: true }))}>
          <RiCalendarScheduleLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          {item.deadline ? "Change deadline" : "Add deadline"}
        </DropdownItem>
        <DropdownItem onSelect={act(() => actions.onDelete(item))}>
          <RiDeleteBinLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          Delete
        </DropdownItem>
        <DropdownDivider />
        {actions.lists.map((l) => {
          const here = l.id === item.list_id;
          return (
            <DropdownItem key={l.id} onSelect={act(() => !here && actions.onMove(item, l.id))}>
              <span className="flex w-4 shrink-0 justify-center">{here ? <RiCheckLine className="size-4" aria-hidden /> : null}</span>
              <span className="truncate">{l.name}</span>
              {here ? <span className="sr-only">(current list)</span> : null}
            </DropdownItem>
          );
        })}
        <DropdownItem onSelect={act(() => actions.onNewList(item))}>
          <RiPlayListAddLine className="size-4 text-foreground-icon-secondary" aria-hidden />
          New list
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  );
}
