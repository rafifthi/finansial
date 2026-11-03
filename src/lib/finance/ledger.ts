import type { Account, Category, Transaction } from "@/lib/sheets/schema";
import { END_OF_MONTH, periodOf } from "./period";

export type Group = Category["group"];

/** Balance per account id: opening + income − expense − transfers out + transfers in. */
export function accountBalances(accounts: Account[], txns: Transaction[], upTo?: string): Map<string, number> {
  const balances = new Map(accounts.map((a) => [a.id, a.opening_balance]));
  const bump = (id: string, delta: number) => {
    if (!id) return;
    balances.set(id, (balances.get(id) ?? 0) + delta);
  };
  for (const t of txns) {
    if (upTo && t.date > upTo) continue;
    if (t.type === "income") bump(t.account_id, t.amount);
    else if (t.type === "expense") bump(t.account_id, -t.amount);
    else {
      bump(t.account_id, -t.amount);
      bump(t.to_account_id, t.amount);
    }
  }
  return balances;
}

export interface MonthTotals {
  income: number;
  /** Spending on Needs + Wants (and uncategorised expenses). */
  spent: number;
  /** Outflows into Savings-group categories (expense or categorised transfer). */
  saved: number;
  byCategory: Map<string, number>;
  byGroup: Record<Group, number>;
}

/**
 * Totals for one month. A Savings-group category counts as "saved" whether
 * it was booked as an expense or as a transfer into an investment account.
 * Plain transfers between own accounts are neutral.
 */
export function monthTotals(txns: Transaction[], categories: Category[], month: string, cutoff = END_OF_MONTH): MonthTotals {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const totals: MonthTotals = {
    income: 0,
    spent: 0,
    saved: 0,
    byCategory: new Map(),
    byGroup: { Needs: 0, Wants: 0, Savings: 0, Income: 0 },
  };
  for (const t of txns) {
    if (periodOf(t.date, cutoff) !== month) continue;
    const cat = catById.get(t.category_id);
    if (t.type === "transfer" && cat?.group !== "Savings") continue;
    if (t.category_id) totals.byCategory.set(t.category_id, (totals.byCategory.get(t.category_id) ?? 0) + t.amount);
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
