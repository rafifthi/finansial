"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import {
  RiAddLine,
  RiArrowDownSLine,
  RiArrowLeftSLine,
  RiCalendarLine,
  RiCheckLine,
  RiDeleteBinLine,
  RiMoreLine,
  RiPencilLine,
  RiStarLine,
} from "@remixicon/react";
import { Button } from "@/components/base/buttons/button";
import { Dropdown, DropdownDivider, DropdownGroup, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { InputBase, TextField } from "@/components/base/input/input";
import { suggestEmoji } from "@/lib/emoji-catalog";
import { moveTo, positionBetween, respace, SCHEDULED_GROUPS, scheduledGroup, SORT_LABELS, sortDone, sortItems, topPosition } from "@/lib/lists/order";
import { LIST_SORTS, type TodoItem, type TodoList } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { EmptyState } from "../card";
import { CATEGORY_COLORS, CategoryIcon } from "../category-icon";
import { PageHeader } from "../page-header";
import { useBookId } from "../permissions";
import { ListDrawer } from "./drawers";
import { ItemComposer } from "./item-fields";
import { ItemsGrid, type RowActions } from "./item-row";
import { Pill } from "./pill";
import { newClientId, useLists, type ItemDraft, type ListInput, type ListsData } from "./use-lists";

const SMART = {
  starred: { name: "Starred", icon: RiStarLine, empty: "Star an item to keep it here, whichever list it's in." },
  scheduled: { name: "Scheduled", icon: RiCalendarLine, empty: "Items with a deadline show up here, soonest first." },
} as const;
type SmartView = keyof typeof SMART;

const STARTERS = [
  { name: "Groceries", emoji: "🛒", color: "lime" },
  { name: "To buy", emoji: "🛍️", color: "orange" },
  { name: "Chores", emoji: "🧹", color: "blue" },
];

/** New lists take the next colour in turn (grey last), so a sidebar of new lists still tells them apart. */
const LIST_COLORS = CATEGORY_COLORS.map((c) => c.id).filter((c) => c !== "neutral");

/** How long a ticked item stays in place before it drops into Completed. */
const SETTLE_MS = 900;

const PANEL = "rounded-3xl border border-separator-border bg-background-primary-default";

/** The inline name fields sit bare inside their row. */
const BARE = "min-h-0 bg-transparent px-0 py-0 shadow-none ring-0 max-sm:min-h-0";

export function ListsView({ initial, today, canEdit, user, personal }: { initial: ListsData; today: string; canEdit: boolean; user: string; personal: boolean }) {
  const bookId = useBookId();
  const { data, patchItems, add, complete, removeItems, upsertList, removeList } = useLists(bookId, initial, user);
  const params = useSearchParams();
  const [settling, setSettling] = useState<ReadonlySet<string>>(new Set());
  const [editing, setEditing] = useState<RowActions["editing"]>(null);
  const [insertAfter, setInsertAfter] = useState<string | null>(null);
  /** `moving`: "New list" from an item's menu, which moves that item into the new list. */
  const [listDrawer, setListDrawer] = useState<{ open: boolean; list: TodoList | null; moving?: TodoItem }>({ open: false, list: null });
  const [showDone, setShowDone] = useState(false);
  const [creating, setCreating] = useState(false);
  /** A list just created inline: its composer takes focus so typing carries straight on. */
  const [fresh, setFresh] = useState<string | null>(null);
  const navigated = useRef(false);

  const lists = useMemo(() => [...data.lists].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)), [data.lists]);
  const listsById = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  // Ticked items stay visible (struck through) for a moment, so a mis-tap is easy to see and undo.
  const visible = useMemo(() => data.items.filter((i) => listsById.has(i.list_id) && (!i.done || settling.has(i.id))), [data.items, listsById, settling]);
  const counts = useMemo(() => {
    const perList = new Map<string, number>();
    let starred = 0;
    let scheduled = 0;
    let overdue = 0;
    for (const i of data.items) {
      if (i.done || !listsById.has(i.list_id)) continue;
      perList.set(i.list_id, (perList.get(i.list_id) ?? 0) + 1);
      if (i.starred) starred++;
      if (i.deadline) {
        scheduled++;
        if (i.deadline < today) overdue++;
      }
    }
    return { perList, starred, scheduled, overdue };
  }, [data.items, listsById, today]);

  // `?list=` picks the view; without one, phones show the index and wider screens the first list.
  const param = params.get("list");
  const explicit = param && (param in SMART || listsById.has(param)) ? param : null;
  const view = explicit ?? lists[0]?.id ?? null;
  const list = view ? listsById.get(view) : undefined;

  const select = (next: string | null) => {
    navigated.current = true;
    window.history.pushState(null, "", next ? `?list=${encodeURIComponent(next)}` : window.location.pathname);
  };
  const back = () => {
    if (navigated.current) window.history.back();
    else window.history.replaceState(null, "", window.location.pathname);
  };

  const toggle = (item: TodoItem) => {
    void complete(item, today);
    if (item.done) return;
    setSettling((s) => new Set(s).add(item.id));
    window.setTimeout(
      () =>
        setSettling((s) => {
          const next = new Set(s);
          next.delete(item.id);
          return next;
        }),
      SETTLE_MS,
    );
  };

  // Moved to another list: it goes on top there.
  const moveItem = (item: TodoItem, listId: string) =>
    patchItems([{ id: item.id, patch: { list_id: listId, position: topPosition(data.items.filter((i) => i.list_id === listId && !i.done)) } }]);

  /**
   * Enter on an item adds the next one right under it: it takes the gap
   * before the following item, and the list is re-spaced only when that gap
   * has run out. The blank row then moves under the new item, so Enter chains.
   */
  const addBelow = (anchor: TodoItem, drafts: ItemDraft[]) => {
    const ordered = sortItems(data.items.filter((i) => i.list_id === anchor.list_id && !i.done), "manual");
    const at = ordered.findIndex((i) => i.id === anchor.id);
    const rows = drafts.map((d) => ({ ...d, id: newClientId() }));
    let before = anchor.position;
    const after = ordered[at + 1]?.position;
    const placed: ItemDraft[] = [];
    for (const row of rows) {
      const position = positionBetween(before, after);
      if (position === null) break;
      placed.push({ ...row, position });
      before = position;
    }
    if (placed.length < rows.length) {
      // No room left between the two: re-space the list with the new items in place.
      const ids = ordered.map((i) => i.id);
      ids.splice(at + 1, 0, ...rows.map((r) => r.id));
      const spaced = new Map(respace(ids).map((p) => [p.id, p.position]));
      void add(anchor.list_id, rows.map((r) => ({ ...r, position: spaced.get(r.id)! })));
      patchItems(ordered.filter((i) => spaced.get(i.id) !== i.position).map((i) => ({ id: i.id, patch: { position: spaced.get(i.id)! } })), "Couldn't save the order");
    } else {
      void add(anchor.list_id, placed);
    }
    setInsertAfter(rows.at(-1)!.id);
  };

  const actions: RowActions = {
    canEdit,
    today,
    lists,
    editing,
    setEditing: (next) => {
      setEditing(next);
      if (next) setInsertAfter(null);
    },
    insertAfter,
    setInsertAfter,
    onAddBelow: addBelow,
    onPatch: (id, patch) => patchItems([{ id, patch }]),
    onToggle: toggle,
    onDelete: (item) => removeItems([item], `Deleted “${item.title}”`),
    onMove: moveItem,
    onNewList: (item) => setListDrawer({ open: true, list: null, moving: item }),
  };

  const saveList = (input: Omit<ListInput, "id"> & { id?: string }, moving?: TodoItem) => {
    const id = input.id ?? newClientId();
    // A new list without a chosen emoji gets one guessed from its name.
    void upsertList({ ...input, id, emoji: input.emoji || (input.id ? "" : (suggestEmoji(input.name, 1)[0] ?? "")) });
    if (moving) moveItem(moving, id);
    if (!input.id) {
      setFresh(id);
      select(id);
    }
  };

  /** Inline creation: the name is all it takes; the emoji is guessed and the colour comes next in turn. */
  const createNamed = (name: string) =>
    saveList({ name, emoji: suggestEmoji(name, 1)[0] ?? "", color: LIST_COLORS[lists.length % LIST_COLORS.length] });

  const listActions = (l: TodoList, done: TodoItem[]) => ({
    onSort: (sort: TodoList["sort"]) => void upsertList({ id: l.id, name: l.name, emoji: l.emoji, color: l.color, sort }),
    onEdit: () => setListDrawer({ open: true, list: l }),
    onDelete: () => removeList(l),
    onClearDone: () => removeItems(done, done.length === 1 ? "Cleared 1 completed item" : `Cleared ${done.length} completed items`),
  });
  const doneIn = (listId: string) => sortDone(data.items.filter((i) => i.list_id === listId && i.done && !settling.has(i.id)));

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      <div className={cx(explicit && "max-sm:hidden")}>
        <PageHeader
          title="Lists"
          description={personal ? "Groceries, things to buy, chores. Only you can see this book's lists." : "Groceries, things to buy, chores. Shared with everyone in this book."}
          actions={
            canEdit && lists.length ? (
              <Button variant="secondary" leadingIcon={RiAddLine} onClick={() => setCreating(true)}>
                New list
              </Button>
            ) : undefined
          }
        />
      </div>

      {lists.length === 0 ? (
        <section className={cx(PANEL, "flex flex-col items-center gap-4 px-4 py-10 text-center")}>
          <div className="flex flex-col gap-1">
            <h2 className="text-headline-semibold text-text-primary">No lists yet</h2>
            <p className="text-body-2-regular text-text-tertiary">{canEdit ? "Name your first list, or start with one of these." : "Lists made by members of this book show up here."}</p>
          </div>
          {canEdit ? (
            <>
              <div className={cx(PANEL, "w-full max-w-sm p-1 text-start")}>
                <NewListRow open onOpenChange={() => {}} onCreate={createNamed} colorHint={LIST_COLORS[0]} />
              </div>
              <div className="flex flex-wrap justify-center gap-1.5">
                {STARTERS.map((s) => (
                  <Pill key={s.name} onPress={() => saveList(s)}>
                    <span aria-hidden>{s.emoji}</span>
                    {s.name}
                  </Pill>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : (
        <div className="grid items-start gap-4 sm:grid-cols-[14rem_minmax(0,1fr)] lg:grid-cols-[16rem_minmax(0,1fr)]">
          <nav aria-label="Lists" className={cx(PANEL, "flex flex-col gap-0.5 p-2", explicit && "max-sm:hidden")}>
            {(Object.keys(SMART) as SmartView[]).map((key) => {
              const Icon = SMART[key].icon;
              return (
                <IndexRow
                  key={key}
                  current={view === key}
                  onSelect={() => select(key)}
                  icon={
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-background-tertiary-default text-foreground-icon-secondary">
                      <Icon className="size-3.5" aria-hidden />
                    </span>
                  }
                  name={SMART[key].name}
                  count={key === "starred" ? counts.starred : counts.scheduled}
                  alert={key === "scheduled" && counts.overdue ? `${counts.overdue} overdue` : undefined}
                />
              );
            })}
            <div className="-mx-2 my-1.5 h-px bg-separator-border" />
            {lists.map((l) => (
              <IndexRow
                key={l.id}
                current={view === l.id}
                onSelect={() => select(l.id)}
                icon={<CategoryIcon name={l.name} emoji={l.emoji} color={l.color} size="sm" />}
                name={l.name}
                count={counts.perList.get(l.id) ?? 0}
                menu={canEdit ? (props) => <ListMenu list={l} doneCount={doneIn(l.id).length} {...listActions(l, doneIn(l.id))} {...props} compact /> : undefined}
              />
            ))}
            {canEdit ? <NewListRow open={creating} onOpenChange={setCreating} onCreate={createNamed} colorHint={LIST_COLORS[lists.length % LIST_COLORS.length]} /> : null}
          </nav>

          <section aria-label={list?.name ?? (view && view in SMART ? SMART[view as SmartView].name : "List")} className={cx(PANEL, "flex min-w-0 flex-col gap-3 p-3 sm:p-4", !explicit && "max-sm:hidden")}>
            <button
              type="button"
              onClick={back}
              className="-ms-1 flex w-fit items-center gap-0.5 rounded-md text-body-2-medium text-button-ghost-foreground outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-9 sm:hidden"
            >
              <RiArrowLeftSLine className="size-5 rtl:-scale-x-100" aria-hidden />
              Lists
            </button>

            {list ? (
              <ListPanel
                key={list.id}
                list={list}
                today={today}
                autoFocus={fresh === list.id}
                items={visible.filter((i) => i.list_id === list.id)}
                done={doneIn(list.id)}
                showDone={showDone}
                setShowDone={setShowDone}
                actions={actions}
                onAdd={(drafts) => add(list.id, drafts)}
                canInsert={list.sort === "manual"}
                onReorder={(ordered, id, index) => patchItems(moveTo(ordered, id, index).map(({ id, position }) => ({ id, patch: { position } })), "Couldn't save the order")}
                {...listActions(list, doneIn(list.id))}
              />
            ) : view && view in SMART ? (
              <SmartPanel view={view as SmartView} items={visible} today={today} actions={actions} listsById={listsById} />
            ) : null}
          </section>
        </div>
      )}

      <ListDrawer
        key={listDrawer.list?.id ?? "new"}
        isOpen={listDrawer.open}
        list={listDrawer.list}
        onClose={() => setListDrawer((s) => ({ ...s, open: false }))}
        onSave={(input) => saveList(input, listDrawer.moving)}
        onDelete={removeList}
      />
    </div>
  );
}

type MenuSlot = (props: { open: boolean; onOpenChange: (open: boolean) => void; triggerClassName: string }) => ReactNode;

/**
 * A row in the lists index. A list's row also carries its menu: ⋯ on hover,
 * or right-click anywhere on the row.
 */
function IndexRow({
  current,
  onSelect,
  icon,
  name,
  count,
  alert,
  menu,
}: {
  current: boolean;
  onSelect: () => void;
  icon: ReactNode;
  name: string;
  count: number;
  alert?: string;
  menu?: MenuSlot;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className={cx(
        "group/nav relative flex items-center rounded-xl transition-colors",
        current ? "sm:bg-background-secondary-default" : "hover:bg-background-secondary-hover",
        menuOpen && "bg-background-secondary-hover",
      )}
      onContextMenu={
        menu
          ? (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
    >
      <button
        type="button"
        onClick={onSelect}
        aria-current={current ? "page" : undefined}
        className="flex min-h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-start outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-11"
      >
        {icon}
        <span className={cx("min-w-0 flex-1 truncate text-body-medium", current ? "text-text-primary" : "text-text-secondary max-sm:text-text-primary")}>{name}</span>
        <span
          className={cx(
            "shrink-0 text-caption-1-medium tabular-nums",
            alert ? "text-text-error-primary" : "text-text-tertiary",
            menu && "sm:group-hover/nav:invisible sm:group-focus-within/nav:invisible",
            menu && menuOpen && "sm:invisible",
          )}
          title={alert}
        >
          {count || ""}
          {alert ? <span className="sr-only">, {alert}</span> : null}
        </span>
      </button>
      {/* Sits over the count on hover; phones reach the same menu from the list's header. */}
      {menu
        ? menu({
            open: menuOpen,
            onOpenChange: setMenuOpen,
            triggerClassName: cx(
              "absolute end-1 top-1/2 size-7 -translate-y-1/2 max-sm:hidden",
              menuOpen ? "flex" : "flex opacity-0 group-hover/nav:opacity-100 focus-visible:opacity-100",
            ),
          })
        : null}
    </div>
  );
}

/**
 * Creating a list is typing its name: Enter creates it and opens it with the
 * cursor already in its first item. The emoji is guessed from the name; the
 * list menu can change it later.
 */
function NewListRow({ open, onOpenChange, onCreate, colorHint }: { open: boolean; onOpenChange: (open: boolean) => void; onCreate: (name: string) => void; colorHint: string }) {
  const [name, setName] = useState("");
  // Enter and Escape close the field, and closing blurs it: the blur mustn't act a second time.
  const settled = useRef(false);
  const done = (create: boolean) => {
    if (settled.current) return;
    settled.current = true;
    const trimmed = name.trim();
    if (create && trimmed) onCreate(trimmed);
    setName("");
    onOpenChange(false);
  };
  const start = () => {
    settled.current = false;
    onOpenChange(true);
  };

  useEffect(() => {
    if (open) settled.current = false;
  }, [open]);

  if (!open) {
    return (
      <button
        type="button"
        onClick={start}
        className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-xl px-2 py-1.5 text-start text-body-medium text-text-tertiary outline-none transition-colors hover:bg-background-secondary-hover hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-11"
      >
        <span className="flex size-6 shrink-0 items-center justify-center rounded-md border border-dashed border-border-button-default">
          <RiAddLine className="size-3.5" aria-hidden />
        </span>
        New list
      </button>
    );
  }

  return (
    <div className="flex min-h-9 items-center gap-2.5 rounded-xl bg-background-secondary-default px-2 py-1.5 max-sm:min-h-11">
      <CategoryIcon name={name || "?"} emoji={suggestEmoji(name, 1)[0]} color={colorHint} size="sm" />
      <TextField
        aria-label="New list name"
        autoFocus
        value={name}
        onChange={setName}
        maxLength={60}
        onKeyDown={(e) => {
          if (e.key === "Enter") done(true);
          if (e.key === "Escape") done(false);
        }}
        onBlur={() => done(true)}
        className="min-w-0 flex-1"
        fieldClassName={BARE}
      >
        <InputBase placeholder="List name" autoComplete="off" enterKeyHint="done" className="ps-0" />
      </TextField>
    </div>
  );
}

function ListPanel({
  list,
  today,
  autoFocus,
  items,
  done,
  showDone,
  setShowDone,
  actions,
  onAdd,
  canInsert,
  onReorder,
  onSort,
  onEdit,
  onDelete,
  onClearDone,
}: {
  list: TodoList;
  today: string;
  autoFocus: boolean;
  items: TodoItem[];
  done: TodoItem[];
  showDone: boolean;
  setShowDone: (v: boolean) => void;
  actions: RowActions;
  onAdd: (drafts: ItemDraft[]) => void;
  /** Enter on an item adds one under it; only meaningful in manual order. */
  canInsert: boolean;
  onReorder: (ordered: TodoItem[], id: string, index: number) => void;
  onSort: (sort: TodoList["sort"]) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearDone: () => void;
}) {
  const ordered = sortItems(items, list.sort);
  const openCount = items.filter((i) => !i.done).length;
  const composerRef = useRef<HTMLInputElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (autoFocus) composerRef.current?.focus();
  }, [autoFocus]);

  // N starts a new item from anywhere on the page, unless something is being typed or a dialog is open.
  useEffect(() => {
    if (!actions.canEdit) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() !== "n" || e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, [contenteditable=true], [role=dialog]")) return;
      e.preventDefault();
      composerRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [actions.canEdit]);

  return (
    <>
      <header className="flex items-center gap-3">
        <CategoryIcon name={list.name} emoji={list.emoji} color={list.color} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-title-3-semibold text-text-primary">{list.name}</h2>
          <p className="text-body-2-regular text-text-tertiary">
            {openCount ? `${openCount} to do` : done.length ? "All done" : "Empty"}
            {list.sort !== "manual" ? ` · by ${SORT_LABELS[list.sort].toLowerCase()}` : ""}
          </p>
        </div>
        {actions.canEdit ? (
          <ListMenu
            list={list}
            doneCount={done.length}
            onSort={onSort}
            onEdit={onEdit}
            onDelete={onDelete}
            onClearDone={onClearDone}
            open={menuOpen}
            onOpenChange={setMenuOpen}
            triggerClassName="flex size-8 max-sm:size-11"
          />
        ) : null}
      </header>

      {actions.canEdit ? <ItemComposer listName={list.name} today={today} onAdd={onAdd} inputRef={composerRef} indent={list.sort === "manual" && ordered.length > 1} /> : null}

      {ordered.length ? (
        <ItemsGrid
          label={`${list.name}: to do`}
          items={ordered}
          actions={actions}
          canInsert={canInsert}
          onReorder={list.sort === "manual" ? (id, index) => onReorder(ordered, id, index) : undefined}
        />
      ) : (
        <EmptyState>{done.length ? "Everything's ticked off." : actions.canEdit ? "Nothing here yet. Type above and press Enter; paste several lines to add them all." : "Nothing here yet."}</EmptyState>
      )}

      {done.length ? (
        <div className="flex flex-col gap-1 border-t border-separator-border pt-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-expanded={showDone}
              onClick={() => setShowDone(!showDone)}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:min-h-11"
            >
              <RiArrowDownSLine className={cx("size-4 transition-transform", !showDone && "-rotate-90 rtl:rotate-90")} aria-hidden />
              Completed · {done.length}
            </button>
            {showDone && actions.canEdit ? (
              <Button variant="ghost" size="small" onClick={onClearDone}>
                Clear
              </Button>
            ) : null}
          </div>
          {showDone ? <ItemsGrid label={`${list.name}: completed`} items={done} actions={actions} /> : null}
        </div>
      ) : null}
    </>
  );
}

function ListMenu({
  list,
  doneCount,
  onSort,
  onEdit,
  onDelete,
  onClearDone,
  open,
  onOpenChange,
  triggerClassName,
  compact,
}: {
  list: TodoList;
  doneCount: number;
  onSort: (sort: TodoList["sort"]) => void;
  onEdit: () => void;
  onDelete: () => void;
  onClearDone: () => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  triggerClassName: string;
  /** In the index: a smaller trigger, and the menu opens beside the row. */
  compact?: boolean;
}) {
  const act = (fn: () => void) => () => {
    onOpenChange(false);
    fn();
  };
  return (
    <Dropdown isOpen={open} onOpenChange={onOpenChange}>
      <DropdownTrigger
        aria-label={`Options for ${list.name}`}
        className={cx(
          "shrink-0 items-center justify-center rounded-lg text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-foreground-icon-primary",
          triggerClassName,
        )}
      >
        <RiMoreLine className="size-4" aria-hidden />
      </DropdownTrigger>
      <DropdownPopover aria-label={`Options for ${list.name}`} placement={compact ? "end top" : "bottom end"} className="w-56">
        <DropdownItem onSelect={act(onEdit)}>
          <RiPencilLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
          Edit list…
        </DropdownItem>
        <DropdownDivider />
        <DropdownGroup label="Sort by">
          {LIST_SORTS.map((s) => (
            <DropdownItem key={s} selected={list.sort === s} onSelect={act(() => onSort(s))}>
              <span className="w-4">{list.sort === s ? <RiCheckLine className="size-4" aria-hidden /> : null}</span>
              {SORT_LABELS[s]}
            </DropdownItem>
          ))}
        </DropdownGroup>
        <DropdownDivider />
        {doneCount ? <DropdownItem onSelect={act(onClearDone)}>Clear completed ({doneCount})</DropdownItem> : null}
        <DropdownItem onSelect={act(onDelete)} className="text-text-error-primary">
          <RiDeleteBinLine className="size-4" aria-hidden />
          Delete list
        </DropdownItem>
      </DropdownPopover>
    </Dropdown>
  );
}

function SmartPanel({ view, items, today, actions, listsById }: { view: SmartView; items: TodoItem[]; today: string; actions: RowActions; listsById: Map<string, TodoList> }) {
  const meta = SMART[view];
  const Icon = meta.icon;
  const shown = sortItems(
    items.filter((i) => (view === "starred" ? i.starred : Boolean(i.deadline))),
    "deadline",
  );
  const groups =
    view === "scheduled"
      ? SCHEDULED_GROUPS.map((g) => ({ ...g, items: shown.filter((i) => scheduledGroup(i.deadline, today) === g.id) })).filter((g) => g.items.length)
      : [{ id: "all", label: "", items: shown }];

  return (
    <>
      <header className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-background-tertiary-default text-foreground-icon-secondary">
          <Icon className="size-5" aria-hidden />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <h2 className="truncate text-title-3-semibold text-text-primary">{meta.name}</h2>
          <p className="text-body-2-regular text-text-tertiary">{shown.length ? `${shown.length} to do, from every list` : "From every list"}</p>
        </div>
      </header>
      {shown.length === 0 ? <EmptyState>{meta.empty}</EmptyState> : null}
      {groups.map((g) => (
        <div key={g.id} className="flex flex-col gap-1">
          {g.label ? <h3 className={cx("px-2 pt-1 text-caption-1-semibold", g.id === "overdue" ? "text-text-error-primary" : "text-text-secondary")}>{g.label}</h3> : null}
          <ItemsGrid label={g.label ? `${meta.name}: ${g.label}` : meta.name} items={g.items} actions={actions} listsById={listsById} />
        </div>
      ))}
    </>
  );
}
