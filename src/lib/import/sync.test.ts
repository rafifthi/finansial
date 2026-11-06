import { describe, expect, it } from "vitest";
import { REFERENCE_FIXTURE } from "./fixtures";
import { planImport } from "./reference";
import { previewSync, syncRows, type SyncExisting } from "./sync";

const plan = planImport(REFERENCE_FIXTURE, { year: 2026, now: "2026-11-03T08:00:00.000Z" });
const meals = plan.categories.find((c) => c.name === "Meals")!;
const gas = plan.transactions.find((t) => t.description === "Gas")!;
const nasi = plan.transactions.find((t) => t.description === "Nasi Padang")!;

const existing = (over: Partial<SyncExisting> = {}): SyncExisting => ({
  transactions: [],
  // The book renamed nothing but uses its own id for Meals; Billing is missing.
  categories: [{ ...meals, id: "own-meals" }],
  installments: [],
  ...over,
});

describe("previewSync", () => {
  it("offers only rows the book doesn't have, newest first", () => {
    const p = previewSync(plan, existing({ transactions: [{ ...gas }] }));
    expect(p.alreadyThere).toBe(1);
    expect(p.candidates.map((c) => c.id)).not.toContain(gas.id);
    expect(p.candidates[0].date >= p.candidates.at(-1)!.date).toBe(true);
  });

  it("flags same-day same-amount entries as likely duplicates and rows without a category", () => {
    const p = previewSync(plan, existing({ transactions: [{ id: "manual", date: nasi.date, type: "expense", amount: nasi.amount, description: "Padang" }] }));
    expect(p.candidates.find((c) => c.id === nasi.id)?.duplicateOf).toBe("Padang");
    expect(p.candidates.find((c) => c.description === "Mystery")?.problem).toBeTruthy();
  });
});

describe("syncRows", () => {
  it("points rows at the book's own categories, and brings over missing ones", () => {
    const { transactions, categories } = syncRows(plan, [nasi.id, gas.id], existing(), "2026-11-05T00:00:00.000Z");
    expect(transactions.find((t) => t.id === nasi.id)).toMatchObject({ category_id: "own-meals" });
    expect(categories.map((c) => c.name)).toEqual(["Billing"]);
    expect(transactions.find((t) => t.id === gas.id)?.category_id).toBe(categories[0].id);
  });

  it("never adds a row twice", () => {
    const { transactions } = syncRows(plan, [gas.id], existing({ transactions: [{ ...gas }] }), "2026-11-05T00:00:00.000Z");
    expect(transactions).toEqual([]);
  });
});
