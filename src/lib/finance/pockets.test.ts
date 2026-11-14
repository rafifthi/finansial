import { describe, expect, it } from "vitest";
import type { Budget, Category, SavingsAdjustment, Transaction } from "@/lib/sheets/schema";
import { budgetMonth, closeMonthPlan } from "./budget";
import { pocketCarry, pocketLedger, pocketsSince } from "./pockets";

const cat = (id: string, group: Category["group"]): Category => ({
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
});

let seq = 0;
const txn = (p: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
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
const budget = (month: string, category_id: string, amount: number): Budget => ({ id: `b${++seq}`, month, category_id, amount });
const adj = (p: Partial<SavingsAdjustment>): SavingsAdjustment => ({
  id: `a${++seq}`,
  category_id: "meals",
  date: "2026-10-15",
  amount: 0,
  note: "Found cash",
  created_at: "",
  created_by: "",
  ...p,
});

const categories = [cat("meals", "Needs"), cat("fun", "Wants"), cat("rumah", "Savings"), cat("salary", "Income")];
const budgets = [
  budget("2026-09", "meals", 5000), // before pockets started: never carries
  budget("2026-10", "meals", 1000),
  budget("2026-10", "fun", 300),
  budget("2026-11", "meals", 1000),
  budget("2026-11", "fun", 300),
];
const txns = [
  txn({ date: "2026-09-10", amount: 100, category_id: "meals" }),
  txn({ date: "2026-10-05", amount: 600, category_id: "meals" }),
  txn({ date: "2026-10-07", amount: 450, category_id: "fun" }), // 150 over
  txn({ date: "2026-10-20", type: "transfer", amount: 50, from_category_id: "meals", category_id: "rumah" }), // 50 to savings
  txn({ date: "2026-11-03", amount: 200, category_id: "meals" }),
];
const adjustments = [adj({ amount: 25 }), adj({ date: "2026-11-02", amount: -10 }), adj({ category_id: "rumah", amount: 999 })];
const base = { since: "2026-10", budgets, categories, txns, adjustments };

describe("pocketsSince", () => {
  it("uses the saved period, else the current one", () => {
    expect(pocketsSince({ pockets_since: "2026-10" }, "2026-11")).toBe("2026-10");
    expect(pocketsSince({}, "2026-11")).toBe("2026-11");
    expect(pocketsSince({ pockets_since: "nope" }, "2026-11")).toBe("2026-11");
  });
});

describe("pocketCarry", () => {
  it("brings each pocket's leftover (or overspend) and earlier adjustments into the next period", () => {
    const carry = pocketCarry({ ...base, month: "2026-11" });
    // meals: 1000 budget − 600 spent − 50 to savings + 25 adjusted = 375
    expect(carry.get("meals")).toEqual({ carried: 375, adjusted: -10 });
    // fun: 300 − 450 = −150 carried as overspend
    expect(carry.get("fun")).toEqual({ carried: -150, adjusted: 0 });
    expect(carry.has("rumah")).toBe(false);
    expect(carry.has("salary")).toBe(false);
  });

  it("carries nothing into the first period, or into periods before pockets started", () => {
    expect(pocketCarry({ ...base, month: "2026-10" }).get("meals")).toEqual({ carried: 0, adjusted: 25 });
    expect(pocketCarry({ ...base, month: "2026-09" }).get("meals")).toEqual({ carried: 0, adjusted: 0 });
  });
});

describe("budgetMonth with pockets", () => {
  it("adds carried money to what a pocket can use this period", () => {
    const pockets = pocketCarry({ ...base, month: "2026-11" });
    const bm = budgetMonth({ month: "2026-11", budgets, categories, txns, pockets });
    const meals = bm.lines.find((l) => l.category.id === "meals")!;
    expect([meals.budget, meals.carried, meals.adjusted, meals.available, meals.actual, meals.remaining]).toEqual([1000, 375, -10, 1365, 200, 1165]);
    // The month's own figures don't change: carried money isn't new budget.
    expect(bm.groups.Needs.budget).toBe(1000);
  });

  it("lets Close the month move the whole pocket, carry included, and skip kept ones", () => {
    const pockets = pocketCarry({ ...base, month: "2026-11" });
    const { lines } = budgetMonth({ month: "2026-11", budgets, categories, txns, pockets });
    // fun is 150 over from October and has 300 this month: 150 left.
    expect(closeMonthPlan(lines, "rumah")).toEqual([
      { from: "meals", to: "rumah", amount: 1165, reason: "save" },
      { from: "fun", to: "rumah", amount: 150, reason: "save" },
    ]);
    expect(closeMonthPlan(lines.filter((l) => l.category.id !== "meals"), "rumah")).toEqual([
      { from: "fun", to: "rumah", amount: 150, reason: "save" },
    ]);
  });
});

describe("pocketLedger", () => {
  it("lists budgets, spending, moves and adjustments with a running balance that matches the carry", () => {
    const l = pocketLedger(cat("meals", "Needs"), { ...base, through: "2026-11" });
    expect(l.entries.map((e) => [e.kind, e.amount, e.balance])).toEqual([
      ["budget", 1000, 1000],
      ["spent", -600, 400],
      ["adjustment", 25, 425],
      ["moved-out", -50, 375],
      ["budget", 1000, 1375],
      ["adjustment", -10, 1365],
      ["spent", -200, 1165],
    ]);
    expect(l.entries.find((e) => e.kind === "moved-out")?.counterpart).toBe("rumah");
    expect(l.balance).toBe(1165);
    expect(l.totals).toEqual({ budgeted: 2000, spent: 800, in: 0, out: 50, adjusted: 15 });
    // Ledger and carry agree: what October ended with is what November brought in.
    const octEnd = l.entries.filter((e) => e.date < "2026-11-01").at(-1)!.balance;
    expect(octEnd).toBe(pocketCarry({ ...base, month: "2026-11" }).get("meals")!.carried);
  });

  it("counts money moved in from another pocket", () => {
    const moved = [...txns, txn({ date: "2026-11-04", type: "transfer", amount: 80, from_category_id: "meals", category_id: "fun" })];
    const fun = pocketLedger(cat("fun", "Wants"), { ...base, txns: moved, through: "2026-11" });
    expect(fun.entries.at(-1)).toMatchObject({ kind: "moved-in", amount: 80, counterpart: "meals", balance: 230 });
  });
});
