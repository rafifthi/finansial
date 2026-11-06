import type { Category, SavingsAdjustment, Transaction } from "@/lib/sheets/schema";
import { END_OF_MONTH, periodOf } from "./period";

export type Group = Category["group"];

/** Categories a transfer may run between: everything except income. */
export const canTransfer = (c: Pick<Category, "kind">) => c.kind === "expense";

/**
 * How a transfer moves budget. Leaving a Needs/Wants category uses up its
 * budget (like spending it); arriving gives the category room back. A Savings
 * category works the other way round: money in is saved, money out is taken
 * from the pot. Returns category id → signed change to that category's actual.
 */
export function transferEffects(t: Pick<Transaction, "amount" | "category_id" | "from_category_id">, catById: Map<string, Category>): [string, number][] {
  const from = catById.get(t.from_category_id);
  const to = catById.get(t.category_id);
  // Transfers recorded before they had a source category only count when they fed savings.
  if (!from) return to?.group === "Savings" ? [[to.id, t.amount]] : [];
  const effects: [string, number][] = [];
  if (canTransfer(from)) effects.push([from.id, from.group === "Savings" ? -t.amount : t.amount]);
  if (to && canTransfer(to)) effects.push([to.id, to.group === "Savings" ? t.amount : -t.amount]);
  return effects;
}

/**
 * What each Savings category holds: its starting balance, plus everything saved
 * into it, minus what was taken out, plus any balance adjustments.
 */
export function savingsBalances(
  categories: Category[],
  txns: Transaction[],
  adjustments: Pick<SavingsAdjustment, "category_id" | "date" | "amount">[] = [],
  upTo?: string,
): Map<string, number> {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const balances = new Map(categories.filter((c) => c.group === "Savings").map((c) => [c.id, c.starting_balance]));
  const bump = (id: string, delta: number) => {
    if (balances.has(id)) balances.set(id, balances.get(id)! + delta);
  };
  for (const t of txns) {
    if (upTo && t.date > upTo) continue;
    if (t.type === "expense") bump(t.category_id, t.amount);
    else if (t.type === "transfer") for (const [id, delta] of transferEffects(t, catById)) bump(id, delta);
  }
  for (const a of adjustments) if (!upTo || a.date <= upTo) bump(a.category_id, a.amount);
  return balances;
}

export interface MonthTotals {
  income: number;
  /** Spending on Needs + Wants (and uncategorised expenses). Moving budget around isn't spending. */
  spent: number;
  /** Net into Savings categories: expenses booked there plus transfers in, minus transfers out. */
  saved: number;
  /** Per category: what counts against its budget (spending plus budget moved out, minus budget moved in). */
  byCategory: Map<string, number>;
  /** Per category: real spending only (expenses booked to it). */
  spentBy: Map<string, number>;
  /** Per Needs/Wants category: budget it sent to Savings pots (net of anything taken back). */
  toSavingsBy: Map<string, number>;
  /** Real spending per group, and net saved; budget moved between Needs and Wants doesn't show here. */
  byGroup: Record<Group, number>;
}

/** Totals for one budget period. */
export function monthTotals(txns: Transaction[], categories: Category[], month: string, cutoff = END_OF_MONTH): MonthTotals {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals: MonthTotals = {
    income: 0,
    spent: 0,
    saved: 0,
    byCategory: new Map(),
    spentBy: new Map(),
    toSavingsBy: new Map(),
    byGroup: { Needs: 0, Wants: 0, Savings: 0, Income: 0 },
  };
  const bump = (map: Map<string, number>, id: string, delta: number) => map.set(id, (map.get(id) ?? 0) + delta);
  const add = (id: string, delta: number) => bump(totals.byCategory, id, delta);
  for (const t of txns) {
    if (periodOf(t.date, cutoff) !== month) continue;
    if (t.type === "transfer") {
      const from = catById.get(t.from_category_id);
      const to = catById.get(t.category_id);
      // Budget a spending category hands to a savings pot (or takes back from one).
      if (from && to && from.group !== "Savings" && to.group === "Savings") bump(totals.toSavingsBy, from.id, t.amount);
      if (from && to && from.group === "Savings" && to.group !== "Savings" && canTransfer(to)) bump(totals.toSavingsBy, to.id, -t.amount);
      for (const [id, delta] of transferEffects(t, catById)) {
        add(id, delta);
        if (catById.get(id)?.group === "Savings") {
          totals.saved += delta;
          totals.byGroup.Savings += delta;
        }
      }
      continue;
    }
    const cat = catById.get(t.category_id);
    if (t.category_id) add(t.category_id, t.amount);
    if (t.category_id && t.type === "expense") bump(totals.spentBy, t.category_id, t.amount);
    if (t.type === "income") {
      totals.income += t.amount;
      totals.byGroup.Income += t.amount;
    } else if (cat?.group === "Savings") {
      totals.saved += t.amount;
      totals.byGroup.Savings += t.amount;
    } else {
      totals.spent += t.amount;
      // Uncategorised spending only shows in `spent`.
      if (cat && cat.group !== "Income") totals.byGroup[cat.group] += t.amount;
    }
  }
  return totals;
}

/** Spending (Needs + Wants) per month for a trend chart. */
export function spendingTrend(txns: Transaction[], categories: Category[], months: string[], cutoff = END_OF_MONTH) {
  return months.map((m) => {
    const t = monthTotals(txns, categories, m, cutoff);
    return { month: m, spent: t.spent, income: t.income, saved: t.saved };
  });
}
