import type { Account, Category } from "@/lib/sheets/schema";

/** What a fresh book starts with; deterministic ids so re-running a setup step adds nothing. */
export function starterRows(kind: "family" | "personal"): { accounts: Account[]; categories: Category[] } {
  const accounts: Account[] = [
    { id: "starter-bank", name: "Bank", type: "bank", opening_balance: 0, archived: false },
    { id: "starter-cash", name: "Cash", type: "cash", opening_balance: 0, archived: false },
  ];
  const c = (slug: string, name: string, group: Category["group"]): Category => ({
    id: `starter-${slug}`,
    name,
    kind: group === "Income" ? "income" : "expense",
    group,
    default_account_id: "starter-bank",
    goal_id: "",
    color: "",
    archived: false,
  });
  const categories: Category[] = [
    c("salary", "Salary", "Income"),
    c("other-income", "Other income", "Income"),
    c("bills", "Bills & utilities", "Needs"),
    c("groceries", "Groceries", "Needs"),
    c("transport", "Transport", "Needs"),
    c("meals", "Meals", "Needs"),
    c("health", "Health", "Needs"),
    c("fun", "Fun & dining out", "Wants"),
    c("shopping", "Shopping", "Wants"),
    c("subscriptions", "Subscriptions", "Wants"),
    c("emergency", "Emergency fund", "Savings"),
    c("savings", kind === "family" ? "Family savings" : "Savings", "Savings"),
  ];
  if (kind === "family") categories.splice(5, 0, c("kids", "Kids", "Needs"));
  return { accounts, categories };
}
