import type { Account, Category, Installment, Recurring, Transaction } from "@/lib/sheets/schema";
import { CATEGORY_GROUPS } from "@/lib/sheets/schema";

export type CategoryGroup = (typeof CATEGORY_GROUPS)[number];

/** Settings key holding the account a category group's money is kept in. */
export const pocketKey = (group: CategoryGroup) => `pocket_${group}`;

/** Group → account id (or "") read from the book's settings. */
export function pocketsOf(settings: Record<string, string>): Record<CategoryGroup, string> {
  return Object.fromEntries(CATEGORY_GROUPS.map((g) => [g, settings[pocketKey(g)] ?? ""])) as Record<CategoryGroup, string>;
}

/** Where a category's money lives: its own default account, else its group's pocket. */
export const accountOfCategory = (c: Pick<Category, "default_account_id" | "group">, pockets: Record<CategoryGroup, string>) =>
  c.default_account_id || pockets[c.group] || "";

/** How many rows point at an account; anything non-zero needs a target to move to before deleting. */
export interface AccountUsage {
  transactions: number;
  recurring: number;
  installments: number;
  categories: number;
  pockets: number;
}

export function accountUsage(
  id: string,
  rows: { transactions: Transaction[]; recurring: Recurring[]; installments: Installment[]; categories: Category[]; pockets: Record<string, string> },
): AccountUsage {
  return {
    transactions: rows.transactions.filter((t) => t.account_id === id || t.to_account_id === id).length,
    recurring: rows.recurring.filter((r) => r.account_id === id || r.to_account_id === id).length,
    installments: rows.installments.filter((i) => i.account_id === id).length,
    categories: rows.categories.filter((c) => c.default_account_id === id).length,
    pockets: Object.values(rows.pockets).filter((a) => a === id).length,
  };
}

export const isUsed = (u: AccountUsage) => Object.values(u).some((n) => n > 0);

type Patch<R> = { key: string; patch: Partial<R> };

/**
 * Everything that changes when account `from` is folded into `to`: references
 * are repointed, and transfers between the two (which would become transfers
 * to itself) are dropped. `to` absorbs `from`'s opening balance so the net
 * total is unchanged.
 */
export function planAccountMerge(
  from: Account,
  to: Account,
  rows: { transactions: Transaction[]; recurring: Recurring[]; installments: Installment[]; categories: Category[]; pockets: Record<CategoryGroup, string> },
) {
  const repoint = <R extends { id: string; account_id: string; to_account_id: string }>(list: R[]) => {
    const update: Patch<R>[] = [];
    const remove: string[] = [];
    for (const r of list) {
      if (r.account_id !== from.id && r.to_account_id !== from.id) continue;
      const account_id = r.account_id === from.id ? to.id : r.account_id;
      const to_account_id = r.to_account_id === from.id ? to.id : r.to_account_id;
      if (to_account_id && account_id === to_account_id) remove.push(r.id);
      else update.push({ key: r.id, patch: { account_id, to_account_id } as Partial<R> });
    }
    return { update, remove };
  };

  return {
    transactions: repoint(rows.transactions),
    recurring: repoint(rows.recurring),
    installments: rows.installments.filter((i) => i.account_id === from.id).map((i) => ({ key: i.id, patch: { account_id: to.id } })),
    categories: rows.categories.filter((c) => c.default_account_id === from.id).map((c) => ({ key: c.id, patch: { default_account_id: to.id } })),
    pockets: (Object.entries(rows.pockets) as [CategoryGroup, string][]).filter(([, a]) => a === from.id).map(([group]) => group),
    openingBalance: to.opening_balance + from.opening_balance,
  };
}
