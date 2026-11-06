import { addDays, addMonths, dayInMonth, daysBetween, toUtc } from "@/lib/finance/dates";
import type { ListSort, Priority, Repeat, TodoItem } from "@/lib/sheets/schema";

/**
 * Pure helpers for Lists, shared by server actions and the client. Items keep
 * a numeric `position` spaced STEP apart, so moving one item only rewrites
 * that item's row: it takes the midpoint of its new neighbours.
 */
export const STEP = 1024;

/** Smallest gap worth splitting; below it the list is re-spaced. */
const MIN_GAP = 1e-6;

/** A position between two neighbours (either may be missing), or null when there's no room left. */
export function positionBetween(before: number | undefined, after: number | undefined): number | null {
  if (before === undefined && after === undefined) return STEP;
  if (before === undefined) return after! - STEP;
  if (after === undefined) return before + STEP;
  if (after - before < MIN_GAP) return null;
  return (before + after) / 2;
}

/** Fresh, evenly spaced positions for ids in their current order. */
export function respace(ids: string[]): { id: string; position: number }[] {
  return ids.map((id, i) => ({ id, position: (i + 1) * STEP }));
}

/**
 * The position updates that move `id` to sit at `index` among `ordered` (the
 * list as shown, `id` included). One update normally; the whole list when the
 * neighbours have run out of room.
 */
export function moveTo(ordered: { id: string; position: number }[], id: string, index: number): { id: string; position: number }[] {
  const rest = ordered.filter((i) => i.id !== id);
  const at = Math.max(0, Math.min(index, rest.length));
  const position = positionBetween(rest[at - 1]?.position, rest[at]?.position);
  if (position !== null) return [{ id, position }];
  const ids = rest.map((i) => i.id);
  ids.splice(at, 0, id);
  return respace(ids);
}

/** A position above everything in the list (new items go on top). */
export function topPosition(items: { position: number }[]): number {
  return items.length ? Math.min(...items.map((i) => i.position)) - STEP : STEP;
}

const PRIORITY_RANK: Record<Priority, number> = { high: 0, medium: 1, low: 2, "": 3 };

const byPosition = (a: TodoItem, b: TodoItem) => a.position - b.position || a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** Open items in the list's chosen order; manual order breaks every tie. */
export function sortItems(items: TodoItem[], sort: ListSort): TodoItem[] {
  const out = [...items];
  switch (sort) {
    case "deadline":
      return out.sort((a, b) => (a.deadline || "9999").localeCompare(b.deadline || "9999") || byPosition(a, b));
    case "priority":
      return out.sort((a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || byPosition(a, b));
    case "starred":
      return out.sort((a, b) => Number(b.starred) - Number(a.starred) || byPosition(a, b));
    default:
      return out.sort(byPosition);
  }
}

/** Completed items, most recently ticked first. */
export function sortDone(items: TodoItem[]): TodoItem[] {
  return [...items].sort((a, b) => b.completed_at.localeCompare(a.completed_at) || byPosition(a, b));
}

export type DeadlineTone = "overdue" | "today" | "soon" | "later";

/** "Today", "Tomorrow", "Fri", "12 Nov" or "12 Nov 2027", with how urgent it is. */
export function deadlineLabel(deadline: string, today: string): { label: string; tone: DeadlineTone } {
  const days = daysBetween(today, deadline);
  const tone: DeadlineTone = days < 0 ? "overdue" : days === 0 ? "today" : days <= 6 ? "soon" : "later";
  if (days === 0) return { label: "Today", tone };
  if (days === 1) return { label: "Tomorrow", tone };
  if (days === -1) return { label: "Yesterday", tone };
  const date = toUtc(deadline);
  if (days > 1 && days <= 6) return { label: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(date), tone };
  const sameYear = deadline.slice(0, 4) === today.slice(0, 4);
  const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: sameYear ? undefined : "numeric", timeZone: "UTC" }).format(date);
  return { label, tone };
}

export const SCHEDULED_GROUPS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "week", label: "Next 7 days" },
  { id: "later", label: "Later" },
] as const;

export type ScheduledGroup = (typeof SCHEDULED_GROUPS)[number]["id"];

export function scheduledGroup(deadline: string, today: string): ScheduledGroup {
  const days = daysBetween(today, deadline);
  return days < 0 ? "overdue" : days === 0 ? "today" : days <= 7 ? "week" : "later";
}

/** Quick deadline picks offered in menus. */
export function deadlinePresets(today: string) {
  return [
    { label: "Today", value: today },
    { label: "Tomorrow", value: addDays(today, 1) },
    { label: "Next week", value: addDays(today, 7) },
  ];
}

/**
 * Text typed or pasted into "Add an item": one item per line, with list
 * bullets and checkboxes from other apps stripped.
 */
export function parseLines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-*•◦▪︎]|\d+[.)]|\[[ xX]?\]|☐|☑|✓|✔)\s*/u, "").replace(/^\[[ xX]?\]\s*/, "").trim())
    .filter(Boolean)
    .map((l) => l.slice(0, 500));
}

export const PRIORITY_LABELS: Record<Priority, string> = { "": "None", low: "Low", medium: "Medium", high: "High" };

export const SORT_LABELS: Record<ListSort, string> = {
  manual: "Manual",
  deadline: "Deadline",
  priority: "Priority",
  starred: "Starred first",
};

export const REPEAT_LABELS: Record<Repeat, string> = { "": "Doesn't repeat", daily: "Daily", weekly: "Weekly", monthly: "Monthly", yearly: "Yearly" };

function step(date: string, repeat: Exclude<Repeat, "">, anchorDay: number): string {
  switch (repeat) {
    case "daily":
      return addDays(date, 1);
    case "weekly":
      return addDays(date, 7);
    // Months keep the original day where they can: 31 Jan → 28 Feb → 31 Mar.
    case "monthly":
      return dayInMonth(addMonths(date.slice(0, 7), 1), anchorDay);
    case "yearly":
      return dayInMonth(addMonths(date.slice(0, 7), 12), anchorDay);
  }
}

/**
 * The deadline of the next occurrence once a repeating item is ticked: one
 * step after its deadline, skipping occurrences already in the past (an overdue
 * daily chore comes back for today). An item
 * with no deadline repeats from today.
 */
export function nextDeadline(deadline: string, repeat: Repeat, today: string): string {
  if (!repeat) return deadline;
  const base = deadline || today;
  const anchorDay = Number(base.slice(8, 10));
  let next = step(base, repeat, anchorDay);
  while (next < today) next = step(next, repeat, anchorDay);
  return next;
}
