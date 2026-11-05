import { describe, expect, it } from "vitest";
import type { Budget, Category, Installment, Recurring, Transaction } from "@/lib/sheets/schema";
import { budgetMonth, closeMonthPlan, copyBudgets } from "./budget";
import { addMonths, dayInMonth, monthDiff, monthsEnding } from "./dates";
import { installmentStatus } from "./installments";
import { monthTotals, savingsBalances } from "./ledger";
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
  from_category_id: "",
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
  goal_id: "",
  starting_balance: 0,
  target_amount: 0,
  target_date: "",
  color: "",
  emoji: "",
  archived: false,
  position: 0,
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
  const txns = [
    txn({ type: "income", amount: 5000, category_id: "salary" }),
    txn({ amount: 300, category_id: "meals" }),
    txn({ amount: 200, category_id: "date" }),
    txn({ amount: 1000, category_id: "travel" }),
    // Month end: Meals' leftover into savings, Date's into Transport.
    txn({ type: "transfer", amount: 150, from_category_id: "meals", category_id: "travel" }),
    txn({ type: "transfer", amount: 40, from_category_id: "date", category_id: "transport" }),
    txn({ date: "2026-11-02", amount: 99, category_id: "meals" }),
  ];

  it("counts budget moved out against the source and in for the target", () => {
    const t = monthTotals(txns, categories, "2026-10");
    expect(t.income).toBe(5000);
    expect(t.spent).toBe(500); // moving budget isn't spending
    expect(t.saved).toBe(1150);
    expect(t.byGroup).toEqual({ Needs: 300, Wants: 200, Savings: 1150, Income: 5000 });
    expect(t.byCategory.get("meals")).toBe(450);
    expect(t.byCategory.get("date")).toBe(240);
    expect(t.byCategory.get("transport")).toBe(-40);
    expect(t.byCategory.get("travel")).toBe(1150);
    // What was really spent, apart from what moved to savings.
    expect(t.spentBy.get("meals")).toBe(300);
    expect(t.toSavingsBy.get("meals")).toBe(150);
    expect(t.toSavingsBy.has("date")).toBe(false); // went to Transport, not savings
  });

  it("takes money out of a savings pot", () => {
    const t = monthTotals([txn({ type: "transfer", amount: 70, from_category_id: "travel", category_id: "meals" })], categories, "2026-10");
    expect(t.saved).toBe(-70);
    expect(t.byCategory.get("travel")).toBe(-70);
    expect(t.byCategory.get("meals")).toBe(-70);
    expect(t.spent).toBe(0);
  });

  it("ignores income in transfers and counts legacy transfers only into savings", () => {
    const t = monthTotals(
      [
        txn({ type: "transfer", amount: 10, from_category_id: "salary", category_id: "meals" }),
        txn({ type: "transfer", amount: 20, category_id: "travel" }),
        txn({ type: "transfer", amount: 30, category_id: "meals" }),
      ],
      categories,
      "2026-10",
    );
    expect(t.byCategory.get("meals")).toBe(-10);
    expect(t.byCategory.has("salary")).toBe(false);
    expect(t.saved).toBe(20);
  });

  it("keeps a running balance per savings pot", () => {
    const pots = categories.map((c) => (c.id === "travel" ? { ...c, starting_balance: 5000 } : c));
    const b = savingsBalances(pots, [...txns, txn({ date: "2026-11-03", type: "transfer", amount: 400, from_category_id: "travel", category_id: "date" })]);
    expect(b.get("travel")).toBe(5000 + 1000 + 150 - 400);
    expect(b.has("meals")).toBe(false);
    expect(savingsBalances(pots, txns, [], "2026-09-30").get("travel")).toBe(5000);
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

  it("plans the month end: cover overspend first, then save the rest", () => {
    const line = (id: string, group: Category["group"], remaining: number) => ({ category: { id, group }, remaining });
    const moves = closeMonthPlan(
      [line("meals", "Needs", 300), line("date", "Wants", 50), line("transport", "Needs", -120), line("travel", "Savings", 500), line("salary", "Income", 9)],
      "travel",
    );
    expect(moves).toEqual([
      { from: "meals", to: "transport", amount: 120, reason: "cover" },
      { from: "meals", to: "travel", amount: 180, reason: "save" },
      { from: "date", to: "travel", amount: 50, reason: "save" },
    ]);
    expect(closeMonthPlan([line("meals", "Needs", 0)], "travel")).toEqual([]);
  });

  it("leaves every Needs and Wants line at zero once the plan is booked", () => {
    const b2: Budget[] = [
      { id: "x1", month: "2026-10", category_id: "meals", amount: 500 },
      { id: "x2", month: "2026-10", category_id: "transport", amount: 100 },
    ];
    const t2 = [txn({ amount: 200, category_id: "meals" }), txn({ amount: 160, category_id: "transport" })];
    const before = budgetMonth({ month: "2026-10", budgets: b2, categories, txns: t2 });
    const booked = closeMonthPlan(before.lines, "travel").map((m) =>
      txn({ type: "transfer", amount: m.amount, from_category_id: m.from, category_id: m.to }),
    );
    const after = budgetMonth({ month: "2026-10", budgets: b2, categories, txns: [...t2, ...booked] });
    for (const l of after.lines.filter((l) => l.category.group === "Needs" || l.category.group === "Wants")) expect(l.remaining).toBe(0);
    expect(after.saved).toBe(240);
    expect(after.spent).toBe(360);
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

describe("installments", () => {
  const mobil: Installment = {
    id: "mobil",
    name: "Cicilan Mobil",
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
    from_category_id: "",
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
