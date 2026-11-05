import type { Category, Goal, SavingsAdjustment, Transaction } from "@/lib/sheets/schema";
import { monthDiff } from "./dates";
import { transferEffects } from "./ledger";
import { END_OF_MONTH, periodOf } from "./period";

export type PotEntryKind = "start" | "saved" | "moved-in" | "moved-out" | "adjustment";

export interface PotEntry {
  /** Transaction or adjustment id; "start" for the starting balance. */
  id: string;
  /** "" for the starting balance. */
  date: string;
  kind: PotEntryKind;
  /** Signed: what the entry did to the pot. */
  amount: number;
  description: string;
  /** Transfers: the category on the other side. */
  counterpart: string;
  /** The pot's balance right after this entry. */
  balance: number;
}

export interface PotMonth {
  month: string;
  in: number;
  out: number;
  /** Balance at the end of the period. */
  end: number;
}

export interface PotLedger {
  balance: number;
  /** Oldest first, starting balance on top. */
  entries: PotEntry[];
  /** Per budget period, oldest first. */
  months: PotMonth[];
  totals: { start: number; in: number; out: number; adjusted: number };
}

/** Every movement of one savings pot with a running balance. */
export function potLedger(
  pot: Category,
  categories: Category[],
  txns: Transaction[],
  adjustments: SavingsAdjustment[],
  cutoff = END_OF_MONTH,
): PotLedger {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const name = (id: string) => catById.get(id)?.name ?? "";
  const moves: (Omit<PotEntry, "balance"> & { order: string })[] = [];

  for (const t of txns) {
    if (t.type === "expense" && t.category_id === pot.id) {
      moves.push({ id: t.id, date: t.date, order: t.created_at, kind: "saved", amount: t.amount, description: t.description, counterpart: "" });
    } else if (t.type === "transfer") {
      const delta = transferEffects(t, catById).find(([id]) => id === pot.id)?.[1];
      if (!delta) continue;
      const incoming = delta > 0;
      moves.push({
        id: t.id,
        date: t.date,
        order: t.created_at,
        kind: incoming ? "moved-in" : "moved-out",
        amount: delta,
        description: t.description,
        counterpart: name(incoming ? t.from_category_id : t.category_id),
      });
    }
  }
  for (const a of adjustments) {
    if (a.category_id !== pot.id) continue;
    moves.push({ id: a.id, date: a.date, order: a.created_at, kind: "adjustment", amount: a.amount, description: a.note, counterpart: "" });
  }
  moves.sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));

  let balance = pot.starting_balance;
  const totals = { start: pot.starting_balance, in: 0, out: 0, adjusted: 0 };
  const entries: PotEntry[] = [
    { id: "start", date: "", kind: "start", amount: pot.starting_balance, description: "Starting balance", counterpart: "", balance },
  ];
  const months = new Map<string, PotMonth>();
  for (const { order: _order, ...m } of moves) {
    balance += m.amount;
    entries.push({ ...m, balance });
    if (m.kind === "adjustment") totals.adjusted += m.amount;
    else if (m.amount > 0) totals.in += m.amount;
    else totals.out -= m.amount;
    const key = periodOf(m.date, cutoff);
    const month = months.get(key) ?? { month: key, in: 0, out: 0, end: 0 };
    if (m.amount > 0) month.in += m.amount;
    else month.out -= m.amount;
    month.end = balance;
    months.set(key, month);
  }
  return { balance, entries, months: [...months.values()], totals };
}

export interface PotTarget {
  target: number;
  /** "" when there's no deadline. */
  date: string;
  /** balance / target, capped at 1. */
  ratio: number;
  remaining: number;
  /** Periods left including the current one; null without a date. */
  monthsLeft: number | null;
  /** Per remaining period to reach the target on time; null without a date. */
  requiredMonthly: number | null;
}

/** Progress toward a pot's target, or null when it has none. */
export function potTarget(
  pot: Pick<Category, "target_amount" | "target_date">,
  balance: number,
  today: string,
  cutoff = END_OF_MONTH,
): PotTarget | null {
  if (!pot.target_amount) return null;
  const remaining = Math.max(pot.target_amount - balance, 0);
  const monthsLeft = pot.target_date ? Math.max(monthDiff(periodOf(today, cutoff), periodOf(pot.target_date, cutoff)) + 1, 0) : null;
  return {
    target: pot.target_amount,
    date: pot.target_date,
    ratio: Math.min(Math.max(balance, 0) / pot.target_amount, 1),
    remaining,
    monthsLeft,
    requiredMonthly: monthsLeft === null ? null : monthsLeft === 0 ? remaining : Math.ceil(remaining / monthsLeft),
  };
}

export interface GoalMerge {
  goal: Goal;
  /** The pot the target lands on; `isNew` when the goal had none and one is created. */
  pot: Category;
  isNew: boolean;
  /** Fields written onto the pot. */
  patch: Partial<Pick<Category, "target_amount" | "target_date" | "starting_balance">>;
  /** Anything the user should know (other linked pots, a starting balance kept). */
  notes: string[];
}

/**
 * How each goal becomes a target on its Savings pot. The pot is the linked one
 * (or a Savings category of the same name); a goal with neither gets a new pot.
 * The goal's "already saved" becomes the pot's starting balance when the pot
 * has none, so no money disappears.
 */
export function planGoalMerge(goals: Goal[], categories: Category[], newId: () => string): GoalMerge[] {
  const savings = categories.filter((c) => c.group === "Savings");
  const taken = new Set<string>();
  return goals.map((goal) => {
    const linked = savings.filter((c) => c.goal_id === goal.id);
    const named = savings.filter((c) => c.name.trim().toLowerCase() === goal.name.trim().toLowerCase());
    const existing = [...linked, ...named].find((c) => !taken.has(c.id));
    const notes: string[] = [];
    if (!existing) {
      const pot: Category = {
        id: newId(),
        name: goal.name,
        kind: "expense",
        group: "Savings",
        goal_id: goal.id,
        starting_balance: goal.starting_amount,
        target_amount: goal.target_amount,
        target_date: goal.target_date,
        color: "",
        emoji: "",
        archived: goal.archived,
        position: 0,
      };
      return { goal, pot, isNew: true, patch: {}, notes: ["No savings pot was linked, so a new one is created."] };
    }
    taken.add(existing.id);
    const others = linked.filter((c) => c.id !== existing.id);
    if (others.length) notes.push(`Also funded by ${others.map((c) => c.name).join(", ")}; the target goes on ${existing.name} only.`);
    const patch: GoalMerge["patch"] = { target_amount: goal.target_amount, target_date: goal.target_date };
    if (goal.starting_amount && existing.starting_balance === 0) patch.starting_balance = goal.starting_amount;
    else if (goal.starting_amount && existing.starting_balance !== goal.starting_amount) {
      notes.push("Keeps the pot's own starting balance, not the goal's \"already saved\" amount.");
    }
    return { goal, pot: existing, isNew: false, patch, notes };
  });
}
