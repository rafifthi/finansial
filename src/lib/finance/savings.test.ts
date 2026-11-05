import { describe, expect, it } from "vitest";
import type { Category, Goal, SavingsAdjustment, Transaction } from "@/lib/sheets/schema";
import { savingsBalances } from "./ledger";
import { planGoalMerge, potLedger, potTarget } from "./savings";

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
  ...extra,
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

const adj = (p: Partial<SavingsAdjustment>): SavingsAdjustment => ({
  id: `a${++seq}`,
  category_id: "travel",
  date: "2026-10-15",
  amount: 0,
  note: "",
  created_at: "",
  created_by: "",
  ...p,
});

const travel = cat("travel", "Savings", { starting_balance: 1000, goal_id: "g" });
const categories = [travel, cat("meals", "Needs"), cat("rumah", "Savings")];

const txns = [
  txn({ date: "2026-10-02", amount: 500, category_id: "travel", description: "Setor" }),
  txn({ date: "2026-10-31", type: "transfer", amount: 120, from_category_id: "meals", category_id: "travel", description: "Leftover" }),
  txn({ date: "2026-11-05", type: "transfer", amount: 200, from_category_id: "travel", category_id: "rumah", description: "Pindah" }),
  txn({ date: "2026-10-03", amount: 999, category_id: "meals" }),
];
const adjustments = [adj({ amount: 25, note: "Bunga" }), adj({ date: "2026-11-06", amount: -5, note: "Admin" }), adj({ category_id: "rumah", amount: 7 })];

describe("potLedger", () => {
  it("lists every movement in date order with a running balance", () => {
    const l = potLedger(travel, categories, txns, adjustments);
    expect(l.entries.map((e) => [e.kind, e.amount, e.balance])).toEqual([
      ["start", 1000, 1000],
      ["saved", 500, 1500],
      ["adjustment", 25, 1525],
      ["moved-in", 120, 1645],
      ["moved-out", -200, 1445],
      ["adjustment", -5, 1440],
    ]);
    expect(l.entries.find((e) => e.kind === "moved-in")?.counterpart).toBe("meals");
    expect(l.entries.find((e) => e.kind === "moved-out")?.counterpart).toBe("rumah");
    expect(l.balance).toBe(1440);
    expect(l.totals).toEqual({ start: 1000, in: 620, out: 200, adjusted: 20 });
    expect(l.months).toEqual([
      { month: "2026-10", in: 645, out: 0, end: 1645 },
      { month: "2026-11", in: 0, out: 205, end: 1440 },
    ]);
  });

  it("agrees with the balance shown everywhere else", () => {
    const b = savingsBalances(categories, txns, adjustments);
    expect(b.get("travel")).toBe(potLedger(travel, categories, txns, adjustments).balance);
    expect(b.get("rumah")).toBe(207);
    expect(savingsBalances(categories, txns, adjustments, "2026-10-31").get("travel")).toBe(1645);
  });

});

describe("potTarget", () => {
  it("tracks progress and the monthly amount still needed", () => {
    const t = potTarget({ target_amount: 30000000, target_date: "2026-11-30" }, 21000000, "2026-10-15")!;
    expect(t).toMatchObject({ remaining: 9000000, monthsLeft: 2, requiredMonthly: 4500000, ratio: 0.7 });
    expect(potTarget({ target_amount: 100, target_date: "" }, 150, "2026-10-15")).toMatchObject({ ratio: 1, remaining: 0, requiredMonthly: null });
    expect(potTarget({ target_amount: 0, target_date: "" }, 150, "2026-10-15")).toBeNull();
  });
});

describe("planGoalMerge", () => {
  const goal = (id: string, name: string, p: Partial<Goal> = {}): Goal => ({
    id,
    name,
    target_amount: 1000,
    target_date: "2027-01-31",
    starting_amount: 0,
    archived: false,
    ...p,
  });
  let n = 0;
  const ids = () => `new${++n}`;

  it("puts each goal's target on its linked pot, keeping what was already saved", () => {
    const pots = [cat("travel", "Savings", { goal_id: "g1" }), cat("rumah", "Savings", { goal_id: "g2", starting_balance: 500 })];
    const [a, b] = planGoalMerge([goal("g1", "Trip", { starting_amount: 300 }), goal("g2", "House", { starting_amount: 900 })], pots, ids);
    expect(a).toMatchObject({ isNew: false, pot: { id: "travel" }, patch: { target_amount: 1000, target_date: "2027-01-31", starting_balance: 300 }, notes: [] });
    // The pot already has its own starting balance: it's kept, and the plan says so.
    expect(b.patch).toEqual({ target_amount: 1000, target_date: "2027-01-31" });
    expect(b.notes).toHaveLength(1);
  });

  it("matches an unlinked goal by name, and makes a pot for one with none", () => {
    const pots = [cat("Rumah", "Savings"), cat("Meals", "Needs")];
    const [byName, fresh] = planGoalMerge([goal("g1", "rumah"), goal("g2", "Meals", { starting_amount: 70 })], pots, ids);
    expect(byName).toMatchObject({ isNew: false, pot: { id: "Rumah" } });
    expect(fresh.isNew).toBe(true);
    expect(fresh.pot).toMatchObject({ name: "Meals", group: "Savings", starting_balance: 70, target_amount: 1000 });
  });

  it("puts a goal funded by two pots on the first, and notes the other", () => {
    const pots = [cat("a", "Savings", { goal_id: "g" }), cat("b", "Savings", { goal_id: "g" })];
    const [m] = planGoalMerge([goal("g", "Both")], pots, ids);
    expect(m.pot.id).toBe("a");
    expect(m.notes[0]).toContain("b");
  });
});
