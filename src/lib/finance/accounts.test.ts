import { describe, expect, it } from "vitest";
import type { Account, Category, Installment, Recurring, Transaction } from "@/lib/sheets/schema";
import { accountOfCategory, accountUsage, isUsed, planAccountMerge, pocketsOf } from "./accounts";

const account = (id: string, opening_balance = 0): Account => ({ id, name: id, type: "bank", opening_balance, institution: "", archived: false });
const txn = (id: string, p: Partial<Transaction>): Transaction => ({
  id,
  date: "2026-10-01",
  type: "expense",
  amount: 100,
  category_id: "",
  account_id: "",
  to_account_id: "",
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
const category = (id: string, group: Category["group"], default_account_id = ""): Category => ({
  id,
  name: id,
  kind: group === "Income" ? "income" : "expense",
  group,
  default_account_id,
  goal_id: "",
  color: "",
  emoji: "",
  archived: false,
});

const pockets = pocketsOf({ pocket_Needs: "old", pocket_Savings: "bibit" });

const rows = {
  transactions: [
    txn("spend", { account_id: "old" }),
    txn("in", { type: "transfer", account_id: "bca", to_account_id: "old" }),
    txn("self", { type: "transfer", account_id: "old", to_account_id: "jago" }),
    txn("other", { account_id: "bca" }),
  ],
  recurring: [{ id: "r1", account_id: "old", to_account_id: "" } as Recurring],
  installments: [{ id: "i1", account_id: "old" } as Installment],
  categories: [category("meals", "Needs", "old"), category("fun", "Wants", "bca")],
  pockets,
};

describe("pockets", () => {
  it("falls back to the group's pocket when a category has no account", () => {
    expect(accountOfCategory(category("x", "Savings"), pockets)).toBe("bibit");
    expect(accountOfCategory(category("x", "Savings", "jago"), pockets)).toBe("jago");
    expect(accountOfCategory(category("x", "Wants"), pockets)).toBe("");
  });
});

describe("planAccountMerge", () => {
  const plan = planAccountMerge(account("old", 50), account("jago", 200), rows);

  it("repoints transactions on either side and drops would-be self transfers", () => {
    expect(plan.transactions.update).toEqual([
      { key: "spend", patch: { account_id: "jago", to_account_id: "" } },
      { key: "in", patch: { account_id: "bca", to_account_id: "jago" } },
    ]);
    expect(plan.transactions.remove).toEqual(["self"]);
  });

  it("moves recurring, installments, category defaults and pockets", () => {
    expect(plan.recurring.update).toHaveLength(1);
    expect(plan.installments).toEqual([{ key: "i1", patch: { account_id: "jago" } }]);
    expect(plan.categories).toEqual([{ key: "meals", patch: { default_account_id: "jago" } }]);
    expect(plan.pockets).toEqual(["Needs"]);
  });

  it("keeps the net total by merging opening balances", () => {
    expect(plan.openingBalance).toBe(250);
  });
});

describe("accountUsage", () => {
  it("counts every reference", () => {
    expect(accountUsage("old", rows)).toEqual({ transactions: 3, recurring: 1, installments: 1, categories: 1, pockets: 1 });
    expect(isUsed(accountUsage("unused", rows))).toBe(false);
  });
});
