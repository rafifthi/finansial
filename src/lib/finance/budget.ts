import type { Budget, Category, Transaction } from "@/lib/sheets/schema";
import { monthTotals, type Group } from "./ledger";

export interface BudgetLine {
  category: Category;
  budget: number;
  actual: number;
  /** actual / budget; 0 when there is no budget. */
  usage: number;
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
}

export function budgetMonth(input: {
  month: string;
  budgets: Budget[];
  categories: Category[];
  txns: Transaction[];
  /** Budget period cut-off day (see period.ts); calendar months by default. */
  cutoff?: number;
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
    return { category, budget, actual, usage: budget > 0 ? actual / budget : 0, remaining: budget - actual };
  };

  // Show active categories plus any archived one that still has data this month.
  const visible = categories.filter(
    (c) => !c.archived || budgets.has(c.id) || totals.byCategory.has(c.id),
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
    lines,
    incomeLines,
    groups,
  };
}

/** Budget rows for `to` copied from `from`, skipping categories already budgeted in `to`. */
export function copyBudgets(budgets: Budget[], from: string, to: string, newId: () => string): Budget[] {
  const existing = new Set(budgets.filter((b) => b.month === to).map((b) => b.category_id));
  return budgets
    .filter((b) => b.month === from && !existing.has(b.category_id))
    .map((b) => ({ ...b, id: newId(), month: to }));
}
