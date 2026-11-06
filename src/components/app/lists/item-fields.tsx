"use client";

import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { parseDate } from "@internationalized/date";
import { RiAddLine, RiAlignLeft, RiCalendarLine, RiCloseLine, RiFlag2Line, RiRepeatLine } from "@remixicon/react";
import { DatePicker } from "@/components/base/date-picker/date-picker";
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from "@/components/base/dropdown/dropdown";
import { InputBase, TextField } from "@/components/base/input/input";
import { Kbd } from "@/components/base/kbd/kbd";
import { addDays } from "@/lib/finance/dates";
import { deadlineLabel, parseLines, PRIORITY_LABELS, REPEAT_LABELS } from "@/lib/lists/order";
import { PRIORITIES, REPEATS, type Priority, type Repeat, type TodoItem } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { Pill } from "./pill";
import type { ItemDraft } from "./use-lists";

export type Draft = Pick<TodoItem, "title" | "note" | "deadline" | "repeat" | "priority">;

export const emptyDraft = (): Draft => ({ title: "", note: "", deadline: "", repeat: "", priority: "" });

export const draftOf = (item: TodoItem): Draft => ({ title: item.title, note: item.note, deadline: item.deadline, repeat: item.repeat, priority: item.priority });

export const PRIORITY_MARK: Record<Priority, { mark: string; className: string }> = {
  "": { mark: "", className: "" },
  low: { mark: "!", className: "text-status-blue-text" },
  medium: { mark: "!!", className: "text-status-orange-text" },
  high: { mark: "!!!", className: "text-status-rose-text" },
};

/** The inputs sit bare on the row; the row's surface shows it's being edited. */
const BARE = "min-h-0 bg-transparent px-0 py-0 shadow-none ring-0 max-sm:min-h-0";

const MENU_TRIGGER = "inline-flex h-7 shrink-0 items-center gap-1 rounded-full px-2 text-body-2-medium transition-colors max-sm:h-9";
const triggerTone = (on: boolean) =>
  on ? "bg-pill-tab-blue-selected-background text-text-primary" : "text-foreground-icon-secondary hover:bg-background-secondary-hover hover:text-foreground-icon-primary";

/**
 * One item's fields, after Google Tasks: the title, then a details line and
 * one-tap deadline, priority and repeat. Used both to add an item and to edit
 * one in place, so the two always look and behave the same.
 *
 * `onLeave` fires when focus moves away for good (not into its own menus or
 * calendar), which is when an edit is saved.
 */
export function ItemFields({
  draft,
  onChange,
  today,
  titleRef,
  titleLabel,
  expanded,
  autoFocus,
  startWithPicker,
  onEnter,
  onEscape,
  onPasteLines,
  onFocusChange,
  onLeave,
  trailing,
  doneStyle,
  placeholder = "Title",
}: {
  placeholder?: string;
  draft: Draft;
  onChange: (patch: Partial<Draft>) => void;
  today: string;
  titleRef: RefObject<HTMLInputElement | null>;
  titleLabel: string;
  /** Show the details line and chips (always while editing; the add row only once in use). */
  expanded: boolean;
  autoFocus?: boolean;
  /** Opens the calendar straight away ("Add deadline" in the item menu). */
  startWithPicker?: boolean;
  onEnter: () => void;
  onEscape: () => void;
  /** Several pasted lines; without it a paste is plain text. */
  onPasteLines?: (lines: string[]) => void;
  onFocusChange?: (focused: boolean) => void;
  onLeave?: () => void;
  /** Extra controls at the end of the title line. */
  trailing?: ReactNode;
  /** A ticked item being edited keeps its struck-through title. */
  doneStyle?: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(Boolean(startWithPicker));
  const [menu, setMenu] = useState<"repeat" | "priority" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const dateRef = useRef<HTMLButtonElement>(null);
  const tomorrow = addDays(today, 1);
  const custom = draft.deadline && draft.deadline !== today && draft.deadline !== tomorrow;
  const busy = pickerOpen || menu !== null;

  useEffect(() => {
    // Mount only: the row takes focus once, when it starts editing. With the calendar opening, it takes focus instead.
    if (autoFocus && !startWithPicker) titleRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A press outside also ends editing, even if focus never reached the fields.
  const leaveRef = useRef(onLeave);
  const busyRef = useRef(busy);
  useEffect(() => {
    leaveRef.current = onLeave;
    busyRef.current = busy;
  });
  useEffect(() => {
    if (!onLeave) return;
    const onPress = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (busyRef.current || !target || rootRef.current?.contains(target) || target.closest("[role=dialog], [role=menu], [role=listbox]")) return;
      leaveRef.current?.();
    };
    document.addEventListener("pointerdown", onPress, true);
    return () => document.removeEventListener("pointerdown", onPress, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- listens for the editor's lifetime; the latest callbacks are read from refs
  }, []);

  // After a menu or the calendar closes, typing carries on in the title.
  const refocus = () => requestAnimationFrame(() => titleRef.current?.focus());

  const onKeyDown = (e: { key: string; preventDefault: () => void }) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnter();
    }
    if (e.key === "Escape") onEscape();
  };

  return (
    <div
      ref={rootRef}
      className="flex min-w-0 flex-1 flex-col gap-1"
      onFocus={() => onFocusChange?.(true)}
      onBlur={(e) => {
        if (rootRef.current?.contains(e.relatedTarget as Node | null)) return;
        onFocusChange?.(false);
        if (!busy) onLeave?.();
      }}
    >
      <div className="flex min-w-0 items-center gap-2">
        <TextField
          aria-label={titleLabel}
          value={draft.title}
          onChange={(title) => onChange({ title })}
          onKeyDown={onKeyDown}
          onPaste={
            onPasteLines
              ? (e) => {
                  const text = e.clipboardData.getData("text");
                  if (!/\r?\n/.test(text.trim())) return;
                  e.preventDefault();
                  onPasteLines(parseLines(`${draft.title}${text}`));
                }
              : undefined
          }
          maxLength={5000}
          className="min-w-0 flex-1"
          fieldClassName={BARE}
        >
          <InputBase
            ref={titleRef}
            placeholder={placeholder}
            enterKeyHint="enter"
            autoComplete="off"
            className={cx("px-0 py-0.5", doneStyle && "text-text-tertiary line-through")}
          />
        </TextField>
        {trailing}
      </div>

      {expanded ? (
        <div className="flex flex-col gap-2 pb-1">
          <div className="flex items-center gap-2">
            <RiAlignLeft className="size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
            <TextField aria-label="Details" value={draft.note} onChange={(note) => onChange({ note })} onKeyDown={onKeyDown} maxLength={2000} className="min-w-0 flex-1" fieldClassName={BARE}>
              <InputBase placeholder="Details" autoComplete="off" className="px-0 text-body-2-regular" />
            </TextField>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <Pill pressed={draft.deadline === today} onPress={() => onChange({ deadline: draft.deadline === today ? "" : today })}>
              Today
            </Pill>
            <Pill pressed={draft.deadline === tomorrow} onPress={() => onChange({ deadline: draft.deadline === tomorrow ? "" : tomorrow })}>
              Tomorrow
            </Pill>
            <Pill ref={dateRef} pressed={Boolean(custom)} icon={RiCalendarLine} label={custom ? undefined : "Pick a deadline"} onPress={() => setPickerOpen(!pickerOpen)}>
              {custom ? deadlineLabel(draft.deadline, today).label : null}
            </Pill>
            {custom ? (
              <button
                type="button"
                aria-label="Remove deadline"
                onClick={() => onChange({ deadline: "" })}
                className="-ms-1 flex size-6 cursor-pointer items-center justify-center rounded-full text-foreground-icon-tertiary outline-none hover:text-foreground-icon-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring max-sm:size-9"
              >
                <RiCloseLine className="size-3.5" aria-hidden />
              </button>
            ) : null}
            <DatePicker
              aria-label="Deadline"
              triggerRef={dateRef}
              isOpen={pickerOpen}
              onOpenChange={(open) => {
                setPickerOpen(open);
                if (!open) refocus();
              }}
              value={draft.deadline ? parseDate(draft.deadline) : null}
              onChange={(d) => onChange({ deadline: d ? d.toString() : "" })}
            />

            {/* Priority and repeat stay together at the end, even when the chips wrap on a phone. */}
            <span className="ms-auto flex items-center gap-1.5">
            <Dropdown
              isOpen={menu === "priority"}
              onOpenChange={(open) => {
                setMenu(open ? "priority" : null);
                if (!open) refocus();
              }}
            >
              <DropdownTrigger aria-label={draft.priority ? `${PRIORITY_LABELS[draft.priority]} priority` : "Priority"} className={cx(MENU_TRIGGER, triggerTone(Boolean(draft.priority)))}>
                {draft.priority ? (
                  <span className={PRIORITY_MARK[draft.priority].className}>{PRIORITY_MARK[draft.priority].mark}</span>
                ) : (
                  <RiFlag2Line className="size-4" aria-hidden />
                )}
                {draft.priority ? PRIORITY_LABELS[draft.priority] : null}
              </DropdownTrigger>
              <DropdownPopover aria-label="Priority" placement="bottom end" className="w-40">
                {[...PRIORITIES].reverse().map((p) => (
                  <DropdownItem
                    key={p || "none"}
                    selected={draft.priority === p}
                    onSelect={() => {
                      onChange({ priority: p });
                      setMenu(null);
                      refocus();
                    }}
                  >
                    <span className={cx("w-5", PRIORITY_MARK[p].className)} aria-hidden>
                      {PRIORITY_MARK[p].mark}
                    </span>
                    {PRIORITY_LABELS[p]}
                  </DropdownItem>
                ))}
              </DropdownPopover>
            </Dropdown>

            <Dropdown
              isOpen={menu === "repeat"}
              onOpenChange={(open) => {
                setMenu(open ? "repeat" : null);
                if (!open) refocus();
              }}
            >
              <DropdownTrigger aria-label={draft.repeat ? `Repeats ${REPEAT_LABELS[draft.repeat].toLowerCase()}` : "Repeat"} className={cx(MENU_TRIGGER, triggerTone(Boolean(draft.repeat)))}>
                <RiRepeatLine className="size-4" aria-hidden />
                {draft.repeat ? REPEAT_LABELS[draft.repeat] : null}
              </DropdownTrigger>
              <DropdownPopover aria-label="Repeat" placement="bottom end" className="w-44">
                {REPEATS.map((r) => (
                  <DropdownItem
                    key={r || "none"}
                    selected={draft.repeat === r}
                    onSelect={() => {
                      onChange({ repeat: r as Repeat });
                      setMenu(null);
                      refocus();
                    }}
                  >
                    {REPEAT_LABELS[r]}
                  </DropdownItem>
                ))}
              </DropdownPopover>
            </Dropdown>
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * A blank item to fill in: the add row at the top of a list, or the row that
 * opens under an item after Enter. Enter saves and leaves a fresh blank row
 * with the cursor in it; pasting several lines adds one item per line.
 */
export function ItemComposer({
  listName,
  today,
  onAdd,
  inputRef,
  indent,
  below,
  onClose,
}: {
  listName: string;
  today: string;
  onAdd: (drafts: ItemDraft[]) => void;
  /** Lets the page focus the add row (the N shortcut, a freshly created list). */
  inputRef?: RefObject<HTMLInputElement | null>;
  /** Phones show a drag handle before each row's checkbox; leave the same room. */
  indent?: boolean;
  /** Opened under an item by Enter: it takes focus, and closes when left empty. */
  below?: boolean;
  onClose?: () => void;
}) {
  const [draft, setDraft] = useState(emptyDraft);
  const [focused, setFocused] = useState(false);
  const ownRef = useRef<HTMLInputElement | null>(null);
  const titleRef = inputRef ?? ownRef;
  const dirty = Boolean(draft.title || draft.note || draft.deadline || draft.repeat || draft.priority);
  const active = below || focused || dirty;

  const save = (titles = parseLines(draft.title), keepFocus = true) => {
    if (!titles.length) return false;
    onAdd(titles.map((title) => ({ ...draft, title, note: titles.length === 1 ? draft.note.trim() : "" })));
    setDraft(emptyDraft());
    if (keepFocus) titleRef.current?.focus();
    return true;
  };

  return (
    <div
      className={cx(
        "flex items-start gap-2 rounded-xl px-1.5 py-1.5 transition-colors duration-150 sm:gap-3 sm:px-2",
        active ? "bg-background-secondary-default" : "hover:bg-background-secondary-hover",
      )}
    >
      {indent ? <span className="-ms-1 w-9 shrink-0 sm:hidden" aria-hidden /> : null}
      {/* The rows' checkbox slot, so titles line up down the list. */}
      <span className="flex h-6 w-4 shrink-0 items-center justify-center" aria-hidden>
        {active ? <span className="size-4 rounded-full border border-border-input" /> : <RiAddLine className="size-4 text-button-ghost-foreground" />}
      </span>
      <ItemFields
        draft={draft}
        onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))}
        today={today}
        titleRef={titleRef}
        titleLabel={`New item in ${listName}`}
        placeholder="New item"
        expanded={active}
        autoFocus={below}
        onEnter={() => save()}
        onEscape={() => {
          setDraft(emptyDraft());
          if (below) onClose?.();
          else titleRef.current?.blur();
        }}
        onPasteLines={(lines) => save(lines)}
        onFocusChange={setFocused}
        onLeave={() => {
          if (!below) return;
          // Leaving a filled-in row under an item keeps it, like Google Tasks.
          save(undefined, false);
          onClose?.();
        }}
        trailing={
          active || below ? null : (
            <Kbd className="max-sm:hidden" title="Press N anywhere on this page to add an item">
              N
            </Kbd>
          )
        }
      />
    </div>
  );
}
