import { describe, expect, it } from "vitest";
import type { Account, Budget, Category, Goal, Installment, Recurring, Transaction } from "@/lib/sheets/schema";
import { budgetMonth, copyBudgets } from "./budget";
import { addMonths, dayInMonth, monthDiff, monthsEnding } from "./dates";
import { goalProgress } from "./goals";
import { installmentStatus } from "./installments";
import { accountBalances, monthTotals } from "./ledger";
import { formatMoney, parseAmount } from "./money";
import { dueTransactions, occurrences } from "./recurring";

let seq = 0;
const nid = () => `id${++seq}`;

const txn = (p: Partial<Transaction>): Transaction => ({
  id: nid(),
  date: "2026-10-01",
  type: "expense",
  amount: 0,
  category_id: "",
  account_id: "jago",
  to_account_id: "",
  member: "",
  description: "",
  verified: false,
  recurring_id: "",
  installment_id: "",
  created_at: "",
  updated_at: "",
  created_by: "",
  updated_by: "",
  ...p,
});

const cat = (id: string, group: Category["group"], extra: Partial<Category> = {}): Category => ({
  id,
  name: id,
  kind: group === "Income" ? "income" : "expense",
  group,
  default_account_id: "",
  goal_id: "",
  color: "",
  archived: false,
  ...extra,
});

const categories = [
  cat("meals", "Needs"),
  cat("transport", "Needs"),
  cat("date", "Wants"),
  cat("travel", "Savings", { goal_id: "g-travel" }),
  cat("salary", "Income"),
];

describe("money", () => {
  it.each([
    ["Rp13,150,000", 13150000],
    ["Rp 13.150.000", 13150000],
    ["-Rp665,790", -665790],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["1500.75", 1500.75],
    ["83333", 83333],
    ["Rp0", 0],
    ["", undefined],
  ])("parseAmount(%s)", (input, expected) => expect(parseAmount(input)).toBe(expected));

  it("formats IDR without decimals", () => {
    expect(formatMoney(1406611).replace(/\s/g, " ")).toBe("Rp 1.406.611");
  });
});

describe("dates", () => {
  it("adds months across years", () => {
    expect(addMonths("2026-11", 3)).toBe("2027-02");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthDiff("2026-10", "2027-01")).toBe(3);
  });
  it("clamps day to month end", () => {
    expect(dayInMonth("2026-02", 31)).toBe("2026-02-28");
    expect(dayInMonth("2028-02", 30)).toBe("2028-02-29");
  });
  it("lists trailing months", () => {
    expect(monthsEnding("2026-02", 3)).toEqual(["2025-12", "2026-01", "2026-02"]);
  });
});

describe("ledger", () => {
  const accounts: Account[] = [
    { id: "jago", name: "Jago", type: "bank", opening_balance: 1000, archived: false },
    { id: "bibit", name: "Bibit", type: "investment", opening_balance: 0, archived: false },
  ];
  const txns = [
    txn({ type: "income", amount: 5000, category_id: "salary" }),
    txn({ amount: 300, category_id: "meals" }),
    txn({ amount: 200, category_id: "date" }),
    txn({ type: "transfer", amount: 1000, to_account_id: "bibit", category_id: "travel" }),
    txn({ type: "transfer", amount: 50, to_account_id: "bibit" }),
    txn({ date: "2026-11-02", amount: 99, category_id: "meals" }),
  ];

  it("derives balances with transfers", () => {
    const b = accountBalances(accounts, txns);
    expect(b.get("jago")).toBe(1000 + 5000 - 300 - 200 - 1000 - 50 - 99);
    expect(b.get("bibit")).toBe(1050);
    expect(accountBalances(accounts, txns, "2026-10-31").get("jago")).toBe(1000 + 5000 - 300 - 200 - 1050);
  });

  it("splits month totals into spent / saved / groups", () => {
    const t = monthTotals(txns, categories, "2026-10");
    expect(t.income).toBe(5000);
    expect(t.spent).toBe(500);
    expect(t.saved).toBe(1000); // categorised savings transfer counts, plain transfer doesn't
    expect(t.byGroup).toEqual({ Needs: 300, Wants: 200, Savings: 1000, Income: 5000 });
  });
});

describe("budget", () => {
  const budgets: Budget[] = [
    { id: "b1", month: "2026-10", category_id: "salary", amount: 13150000 },
    { id: "b2", month: "2026-10", category_id: "meals", amount: 1500000 },
    { id: "b3", month: "2026-10", category_id: "travel", amount: 1000000 },
    { id: "b4", month: "2026-09", category_id: "meals", amount: 1400000 },
  ];
  const txns = [txn({ amount: 1406611, category_id: "meals" }), txn({ amount: 1000000, category_id: "travel" })];

  it("computes allocation and usage", () => {
    const m = budgetMonth({ month: "2026-10", budgets, categories, txns });
    expect(m.plannedIncome).toBe(13150000);
    expect(m.allocated).toBe(2500000);
    expect(m.nonAllocated).toBe(10650000);
    expect(m.budgetedExpenses).toBe(1500000);
    const meals = m.lines.find((l) => l.category.id === "meals")!;
    expect(meals.remaining).toBe(93389);
    expect(meals.usage).toBeCloseTo(0.9377, 4);
    expect(m.groups.Savings).toEqual({ budget: 1000000, actual: 1000000 });
  });

  it("copies budgets without overwriting", () => {
    const copied = copyBudgets(budgets, "2026-10", "2026-11", nid);
    expect(copied.map((b) => [b.month, b.category_id])).toEqual([
      ["2026-11", "salary"],
      ["2026-11", "meals"],
      ["2026-11", "travel"],
    ]);
    expect(copyBudgets([...budgets, ...copied], "2026-10", "2026-11", nid)).toEqual([]);
  });
});

describe("goals", () => {
  const goal: Goal = {
    id: "g-travel",
    name: "Travel",
    target_amount: 30000000,
    target_date: "2026-11-30",
    starting_amount: 20000000,
    archived: false,
  };
  it("tracks progress and required monthly amount", () => {
    const p = goalProgress(goal, categories, [txn({ amount: 1000000, category_id: "travel" })], "2026-10-15");
    expect(p.saved).toBe(21000000);
    expect(p.remaining).toBe(9000000);
    expect(p.monthsLeft).toBe(2);
    expect(p.requiredMonthly).toBe(4500000);
    expect(p.history).toEqual([{ month: "2026-10", amount: 1000000 }]);
  });
});

describe("installments", () => {
  const mobil: Installment = {
    id: "mobil",
    name: "Cicilan Mobil",
    account_id: "",
    category_id: "",
    monthly_amount: 2000000,
    tenor_months: 33,
    start_month: "2026-10",
    total_amount: 64900000,
    note: "",
  };
  it("reports month n, payoff month and due state", () => {
    const paidOct = [txn({ amount: 2000000, installment_id: "mobil", date: "2026-10-05" })];
    const s = installmentStatus(mobil, paidOct, "2026-11-03");
    expect(s.currentIndex).toBe(2);
    expect(s.payoffMonth).toBe("2029-06");
    expect(s.remaining).toBe(62900000);
    expect(s.isDue).toBe(true);
    const s2 = installmentStatus(mobil, [...paidOct, txn({ amount: 2000000, installment_id: "mobil", date: "2026-11-01" })], "2026-11-03");
    expect(s2.isDue).toBe(false);
  });
});

describe("recurring", () => {
  const rule: Recurring = {
    id: "wifi",
    type: "expense",
    amount: 333000,
    category_id: "billing",
    account_id: "jenius",
    to_account_id: "",
    member: "",
    description: "Wifi",
    frequency: "monthly",
    day: 31,
    start_date: "2026-01-15",
    end_date: "",
    last_run: "",
    installment_id: "",
  };
  it("clamps month-end occurrences", () => {
    expect(occurrences(rule, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
  });
  it("weekly occurrences land on the weekday", () => {
    // 2026-11-02 is a Monday
    expect(occurrences({ ...rule, frequency: "weekly", day: 1, start_date: "2026-11-01" }, "2026-11-01", "2026-11-20")).toEqual([
      "2026-11-02",
      "2026-11-09",
      "2026-11-16",
    ]);
  });
  it("is idempotent", () => {
    const first = dueTransactions({ ...rule, start_date: "2026-09-01" }, [], "2026-11-03", nid);
    expect(first.map((t) => t.date)).toEqual(["2026-09-30", "2026-10-31"]);
    expect(dueTransactions({ ...rule, start_date: "2026-09-01" }, first, "2026-11-03", nid)).toEqual([]);
    expect(dueTransactions({ ...rule, start_date: "2026-09-01", last_run: "2026-10-31" }, [], "2026-11-03", nid)).toEqual([]);
  });
});
