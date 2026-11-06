import type { Category } from "@/lib/sheets/schema";

/** What a fresh book starts with; deterministic ids so re-running a setup step adds nothing. */
export function starterRows(kind: "family" | "personal"): { categories: Category[] } {
  const c = (slug: string, name: string, group: Category["group"], emoji: string, color: string): Category => ({
    id: `starter-${slug}`,
    name,
    kind: group === "Income" ? "income" : "expense",
    group,
    goal_id: "",
    starting_balance: 0,
    target_amount: 0,
    target_date: "",
    color,
    emoji,
    archived: false,
    position: 0,
  });
  const categories: Category[] = [
    c("salary", "Salary", "Income", "💼", "lime"),
    c("other-income", "Other income", "Income", "🪙", "cyan"),
    c("bills", "Bills & utilities", "Needs", "🧾", "blue"),
    c("groceries", "Groceries", "Needs", "🛒", "lime"),
    c("transport", "Transport", "Needs", "🚗", "yellow"),
    c("meals", "Meals", "Needs", "🍜", "orange"),
    c("health", "Health", "Needs", "💊", "rose"),
    c("fun", "Fun & dining out", "Wants", "🎉", "orange"),
    c("shopping", "Shopping", "Wants", "🛍️", "purple"),
    c("subscriptions", "Subscriptions", "Wants", "📺", "cyan"),
    c("emergency", "Emergency fund", "Savings", "🚨", "rose"),
    c("savings", kind === "family" ? "Family savings" : "Savings", "Savings", "🐷", "purple"),
  ];
  if (kind === "family") categories.splice(5, 0, c("kids", "Kids", "Needs", "👶", "yellow"));
  return { categories };
}
