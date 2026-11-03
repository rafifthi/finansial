import type { Category, Goal, Transaction } from "@/lib/sheets/schema";
import { monthDiff } from "./dates";
import { END_OF_MONTH, periodOf } from "./period";

export interface GoalProgress {
  goal: Goal;
  saved: number;
  ratio: number;
  remaining: number;
  /** Months left including the current one; null without a target date. */
  monthsLeft: number | null;
  /** Amount per remaining month to hit the target on time. */
  requiredMonthly: number | null;
  /** Contributions per budget period (YYYY-MM → amount), oldest first. */
  history: { month: string; amount: number }[];
}

/**
 * A goal is funded by every transaction in a category linked to it
 * (Category.goal_id), e.g. the "Travel" savings category feeds the Travel goal.
 */
export function goalProgress(goal: Goal, categories: Category[], txns: Transaction[], today: string, cutoff = END_OF_MONTH): GoalProgress {
  const period = (d: string) => periodOf(d, cutoff);
  const linked = new Set(categories.filter((c) => c.goal_id === goal.id).map((c) => c.id));
  const perMonth = new Map<string, number>();
  let contributed = 0;
  for (const t of txns) {
    if (!linked.has(t.category_id) || t.type === "income") continue;
    contributed += t.amount;
    const m = period(t.date);
    perMonth.set(m, (perMonth.get(m) ?? 0) + t.amount);
  }
  const saved = goal.starting_amount + contributed;
  const remaining = Math.max(goal.target_amount - saved, 0);
  const monthsLeft = goal.target_date ? Math.max(monthDiff(period(today), period(goal.target_date)) + 1, 0) : null;
  return {
    goal,
    saved,
    ratio: goal.target_amount > 0 ? Math.min(saved / goal.target_amount, 1) : 0,
    remaining,
    monthsLeft,
    requiredMonthly: monthsLeft === null ? null : monthsLeft === 0 ? remaining : Math.ceil(remaining / monthsLeft),
    history: [...perMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, amount]) => ({ month, amount })),
  };
}
