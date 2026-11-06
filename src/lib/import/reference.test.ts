import { describe, expect, it } from "vitest";
import { REFERENCE_FIXTURE } from "./fixtures";
import { planImport } from "./reference";

const grids = REFERENCE_FIXTURE;

describe("planImport", () => {
  const plan = planImport(grids, { year: 2026, now: "2026-11-03T08:00:00.000Z" });
  const cat = (name: string) => plan.categories.find((c) => c.name === name)!;

  it("maps categories with their groups, and goals onto their savings pots", () => {
    expect(cat("Meals")).toMatchObject({ group: "Needs", starting_balance: 0 });
    expect(cat("Groceries").group).toBe("Needs");
    expect(cat("Travel")).toMatchObject({ group: "Savings", target_amount: 30000000, target_date: "2026-11-30", starting_balance: 0 });
    expect(cat("Rumah")).toMatchObject({ target_amount: 50000000, target_date: "2026-12-31" });
    expect(cat("Dana Darurat")).toMatchObject({ target_amount: 30000000, target_date: "", starting_balance: 21745790 });
    expect(cat("Monthly Kanza").kind).toBe("income");
    // Only in the Budgeting matrix:
    expect(cat("Cicilan Mobil").group).toBe("Needs");
  });

  it("turns the month matrix into budget rows", () => {
    const oct = plan.budgets.filter((b) => b.month === "2026-10");
    expect(oct.map((b) => [b.category_id, b.amount])).toEqual([
      ["cat-monthly-kanza", 6000000],
      ["cat-monthly-rafif", 6000000],
      ["cat-travel", 1000000],
      ["cat-meals", 1500000],
      ["cat-cicilan-mobil", 2000000],
    ]);
    expect(plan.budgets.some((b) => b.category_id.includes("sisa"))).toBe(false);
  });

  it("imports spending with verified flags and stable, distinct ids", () => {
    const spending = plan.transactions.filter((t) => !t.installment_id);
    expect(spending).toHaveLength(5);
    expect(spending[0]).toMatchObject({ date: "2026-10-01", amount: 230000, category_id: "cat-billing", verified: true });
    expect(spending[1].verified).toBe(false);
    expect(spending[2].id).not.toBe(spending[3].id);
    const again = planImport(grids, { year: 2026, now: "2026-12-01T00:00:00.000Z" });
    expect(again.transactions.map((t) => t.id)).toEqual(plan.transactions.map((t) => t.id));
    expect(plan.warnings.some((w) => w.includes("Unknown"))).toBe(true);
  });

  it("parses installments and settings", () => {
    const mobil = plan.installments.find((i) => i.name === "Cicilan Mobil")!;
    expect(mobil).toMatchObject({ monthly_amount: 2000000, tenor_months: 33, start_month: "2026-10", total_amount: 64900000 });
    expect(plan.transactions.filter((t) => t.installment_id === mobil.id).map((t) => t.date)).toEqual(["2026-10-01", "2026-11-01"]);
    const kai = plan.installments.find((i) => i.name === "KAI Pulang")!;
    expect(kai).toMatchObject({ monthly_amount: 450000, start_month: "2026-10", tenor_months: 3, note: "CC JENIUS RAFIF" });
    expect(plan.settings).toEqual([{ key: "members", value: "Kanza,Rafif" }]);
  });

  it("handles exports where merged header cells are split over rows", () => {
    const split = planImport(
      {
        ...grids,
        setup: grids.setup.map((r, i) => (i === 0 ? r.map((c) => (c === "Payday Date" ? "" : c)) : r)),
        goals: [
          ["Travel Goals : Rp.30.000.000", "", "", "", "Dandur Goals : Rp.30.000.000"],
          ["", "", "", "", "Now : Rp.21.745.790"],
          ["By November 2026", "", "", "", ""],
          ["Month", "", "", "", "Month"],
          ["January", "Rp382,500", "", "", "January"],
        ],
        mobil: grids.mobil.slice(1),
      },
      { year: 2026, now: "2026-11-03T08:00:00.000Z" },
    );
    const pot = (name: string) => split.categories.find((c) => c.name === name)!;
    expect([pot("Travel").target_date, pot("Travel").starting_balance]).toEqual(["2026-11-30", 0]);
    expect([pot("Dana Darurat").target_date, pot("Dana Darurat").starting_balance]).toEqual(["", 21745790]);
    expect(split.installments.find((i) => i.name === "Cicilan Mobil")).toMatchObject({ tenor_months: 4, total_amount: 0 });
  });

  it("finds the Setup header row after leading blank rows (Sheets API layout)", () => {
    const plan2 = planImport({ ...grids, setup: [[], ...grids.setup] }, { year: 2026, now: "2026-11-03T08:00:00.000Z" });
    expect(plan2.categories.find((c) => c.name === "Monthly Kanza")?.kind).toBe("income");
    expect(plan2.categories.find((c) => c.name === "Petty Cash")?.group).toBe("Wants");
  });
});
