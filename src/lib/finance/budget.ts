import type { Budget, Category, Transaction } from "@/lib/sheets/schema";
import { monthTotals, type Group } from "./ledger";
import type { PocketCarry } from "./pockets";

export interface BudgetLine {
  category: Category;
  budget: number;
  /** Spending plus budget moved out, minus budget moved in (for Savings: net saved). */
  actual: number;
  /** Real spending (expenses) only. */
  spent: number;
  /** Needs/Wants: budget sent to savings pots. The rest of `actual − spent` went to other categories. */
  toSavings: number;
  /** Pockets (Needs/Wants): balance brought in from earlier periods; 0 otherwise. */
  carried: number;
  /** Pockets: balance adjustments dated in this period. */
  adjusted: number;
  /** What the line can use this period: budget + carried + adjusted. */
  available: number;
  /** actual / available; 0 when nothing is available. */
  usage: number;
  /** available − actual: for a pocket, its balance at the end of the period so far. */
  remaining: number;
}

export interface BudgetMonth {
  month: string;
  plannedIncome: number;
  actualIncome: number;
  /** Budgets on Needs + Wants + Savings categories. */
  allocated: number;
  /** plannedIncome − allocated (the sheet's "Non-allocated"). */
  nonAllocated: number;
  /** allocated / plannedIncome (the sheet's "Allocated Money"). */
  allocationRatio: number;
  budgetedExpenses: number;
  spent: number;
  saved: number;
  lines: BudgetLine[];
  incomeLines: BudgetLine[];
  groups: Record<Exclude<Group, "Income">, { budget: number; actual: number }>;
  /** Where the money went: real spending on Needs and Wants, and net saved. Budget moved between them isn't counted twice. */
  outByGroup: Record<Exclude<Group, "Income">, number>;
}

export function budgetMonth(input: {
  month: string;
  budgets: Budget[];
  categories: Category[];
  txns: Transaction[];
  /** Budget period cut-off day (see period.ts); calendar months by default. */
  cutoff?: number;
  /** Pocket balances brought into the month (see pockets.ts); without it each month stands alone. */
  pockets?: Map<string, PocketCarry>;
}): BudgetMonth {
  const { month, categories, txns } = input;
  const budgets = new Map<string, number>();
  for (const b of input.budgets) {
    if (b.month === month) budgets.set(b.category_id, (budgets.get(b.category_id) ?? 0) + b.amount);
  }
  const totals = monthTotals(txns, categories, month, input.cutoff);

  const toLine = (category: Category): BudgetLine => {
    const budget = budgets.get(category.id) ?? 0;
    const actual = totals.byCategory.get(category.id) ?? 0;
    const { carried, adjusted } = input.pockets?.get(category.id) ?? { carried: 0, adjusted: 0 };
    const available = budget + carried + adjusted;
    return {
      category,
      budget,
      actual,
      spent: totals.spentBy.get(category.id) ?? 0,
      toSavings: totals.toSavingsBy.get(category.id) ?? 0,
      carried,
      adjusted,
      available,
      usage: available > 0 ? actual / available : 0,
      remaining: available - actual,
    };
  };

  // Show active categories plus any archived one that still has data this month.
  const visible = categories.filter(
    (c) => !c.archived || budgets.has(c.id) || totals.byCategory.has(c.id) || Boolean(input.pockets?.get(c.id)?.carried),
  );
  const lines = visible.filter((c) => c.kind === "expense").map(toLine);
  const incomeLines = visible.filter((c) => c.kind === "income").map(toLine);

  const groups = { Needs: { budget: 0, actual: 0 }, Wants: { budget: 0, actual: 0 }, Savings: { budget: 0, actual: 0 } };
  for (const l of lines) {
    if (l.category.group === "Income") continue;
    groups[l.category.group].budget += l.budget;
    groups[l.category.group].actual += l.actual;
  }

  const plannedIncome = incomeLines.reduce((s, l) => s + l.budget, 0);
  const allocated = lines.reduce((s, l) => s + l.budget, 0);
  return {
    month,
    plannedIncome,
    actualIncome: totals.income,
    allocated,
    nonAllocated: plannedIncome - allocated,
    allocationRatio: plannedIncome > 0 ? allocated / plannedIncome : 0,
    budgetedExpenses: groups.Needs.budget + groups.Wants.budget,
    spent: totals.spent,
    saved: totals.saved,
    outByGroup: { Needs: totals.byGroup.Needs, Wants: totals.byGroup.Wants, Savings: totals.byGroup.Savings },
    lines,
    incomeLines,
    groups,
  };
}

export interface MonthMove {
  from: string;
  to: string;
  amount: number;
  /** "cover" tops up a line that went over budget; "save" sends a leftover to savings. */
  reason: "cover" | "save";
}

/**
 * Month-end plan for Needs and Wants: leftovers first cover the lines that went
 * over budget, and whatever is still left goes to the `saveTo` Savings category.
 * `remaining` is the pocket's whole balance, carried-over money included; lines
 * the user keeps are left out by the caller and carry into next month.
 * Largest first on both sides, so it takes few transfers.
 */
export function closeMonthPlan(
  lines: { category: Pick<Category, "id" | "group">; remaining: number }[],
  saveTo: string,
): MonthMove[] {
  const spending = lines.filter((l) => l.category.group === "Needs" || l.category.group === "Wants");
  const leftovers = spending
    .filter((l) => l.remaining > 0)
    .map((l) => ({ id: l.category.id, left: l.remaining }))
    .sort((a, b) => b.left - a.left);
  const over = spending
    .filter((l) => l.remaining < 0)
    .map((l) => ({ id: l.category.id, need: -l.remaining }))
    .sort((a, b) => b.need - a.need);

  const moves: MonthMove[] = [];
  for (const o of over) {
    for (const l of leftovers) {
      if (o.need <= 0) break;
      const amount = Math.min(l.left, o.need);
      if (amount <= 0) continue;
      moves.push({ from: l.id, to: o.id, amount, reason: "cover" });
      l.left -= amount;
      o.need -= amount;
    }
  }
  if (saveTo) for (const l of leftovers) if (l.left > 0) moves.push({ from: l.id, to: saveTo, amount: l.left, reason: "save" });
  return moves;
}

/** Budget rows for `to` copied from `from`, skipping categories already budgeted in `to`. */
export function copyBudgets(budgets: Budget[], from: string, to: string, newId: () => string): Budget[] {
  const existing = new Set(budgets.filter((b) => b.month === to).map((b) => b.category_id));
  return budgets
    .filter((b) => b.month === from && !existing.has(b.category_id))
    .map((b) => ({ ...b, id: newId(), month: to }));
}
