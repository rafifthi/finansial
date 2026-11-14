import { describe, expect, it } from "vitest";
import type { Installment, Transaction } from "@/lib/sheets/schema";
import { dueDifference, installmentSchedule, matchInstallment, mismatchedPayments, normalizeName, unlinkedPayments } from "./installments";

const inst = (id: string, name: string, extra: Partial<Installment> = {}): Installment => ({
  id,
  name,
  category_id: "cicilan",
  monthly_amount: 2_000_000,
  tenor_months: 12,
  start_month: "2026-09",
  total_amount: 0,
  note: "",
  ...extra,
});

let seq = 0;
const txn = (p: Partial<Transaction>): Transaction => ({
  id: `t${++seq}`,
  date: "2026-10-05",
  type: "expense",
  amount: 2_000_000,
  category_id: "cicilan",
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

const mobil = inst("mobil", "Cicilan Mobil");
const mobilBaru = inst("baru", "Cicilan Mobil Baru");
const kai = inst("kai", "KAI Berangkat", { monthly_amount: 450_000 });

describe("normalizeName", () => {
  it("ignores case, spacing and punctuation", () => {
    expect(normalizeName("  Cicilan   Mobil, ")).toBe("cicilan mobil");
    expect(normalizeName("KAI-Berangkat")).toBe("kai berangkat");
  });
});

describe("matchInstallment", () => {
  it("matches the name, or the name as whole words inside the description", () => {
    expect(matchInstallment("cicilan mobil", [mobil, kai])?.id).toBe("mobil");
    expect(matchInstallment("Cicilan Mobil Nov", [mobil, kai])?.id).toBe("mobil");
    expect(matchInstallment("Bayar KAI berangkat", [mobil, kai])?.id).toBe("kai");
  });

  it("prefers an exact name, then the longest one", () => {
    expect(matchInstallment("Cicilan Mobil Baru Nov", [mobil, mobilBaru])?.id).toBe("baru");
    expect(matchInstallment("Cicilan Mobil", [mobilBaru, mobil])?.id).toBe("mobil");
  });

  it("doesn't match partial words, other text, or finished installments", () => {
    expect(matchInstallment("Cicilan Mobilio", [mobil])).toBeUndefined();
    expect(matchInstallment("Nasi Padang", [mobil, kai])).toBeUndefined();
    expect(matchInstallment("", [mobil])).toBeUndefined();
    expect(matchInstallment("Cicilan Mobil", [{ ...mobil, isComplete: true }])).toBeUndefined();
  });
});

describe("due checks", () => {
  it("flags payments that aren't the monthly due", () => {
    expect(dueDifference(2_050_000, mobil)).toBe(50_000);
    expect(dueDifference(2_000_000, mobil)).toBe(0);
    const paid = [
      txn({ installment_id: "mobil", date: "2026-09-05" }),
      txn({ installment_id: "mobil", date: "2026-10-05", amount: 1_950_000 }),
      txn({ installment_id: "kai", amount: 1 }),
    ];
    expect(mismatchedPayments(mobil, paid).map((t) => t.amount)).toEqual([1_950_000]);
  });

  it("finds unlinked expenses named like the installment, from its first month", () => {
    const txns = [
      txn({ description: "Cicilan Mobil", date: "2026-08-05" }), // before it started
      txn({ description: "Cicilan Mobil", date: "2026-09-05" }),
      txn({ description: "cicilan mobil okt", date: "2026-10-05" }),
      txn({ description: "Cicilan Mobil", installment_id: "mobil" }), // already linked
      txn({ description: "Cicilan Mobil", type: "transfer" }),
      txn({ description: "Cicilan Mobil Baru", date: "2026-10-06" }), // the other one
    ];
    expect(unlinkedPayments(mobil, [mobil, mobilBaru], txns).map((t) => t.date)).toEqual(["2026-09-05", "2026-10-05"]);
  });
});

describe("installmentSchedule", () => {
  it("settles steps with payments in date order and marks the rest", () => {
    const plan = inst("plan", "Plan", { tenor_months: 4, start_month: "2026-09", monthly_amount: 100 });
    const txns = [
      txn({ installment_id: "plan", date: "2026-10-03", amount: 120 }),
      txn({ installment_id: "plan", date: "2026-09-02", amount: 100 }),
    ];
    const steps = installmentSchedule(plan, txns, "2026-11-14");
    expect(steps.map((s) => [s.n, s.month, s.status, s.amount, s.off])).toEqual([
      [1, "2026-09", "completed", 100, 0],
      [2, "2026-10", "completed", 120, 20],
      [3, "2026-11", "due", 100, 0],
      [4, "2026-12", "upcoming", 100, 0],
    ]);
    expect(steps[0].payment?.date).toBe("2026-09-02");
    // A month that passed unpaid is overdue.
    expect(installmentSchedule(plan, txns.slice(1), "2026-11-14").map((s) => s.status)).toEqual(["completed", "overdue", "due", "upcoming"]);
  });

  it("settles the month a payment was made in, so a skipped month shows overdue", () => {
    const plan = inst("plan", "Plan", { tenor_months: 3, start_month: "2026-10", monthly_amount: 100 });
    const paidInNov = [txn({ installment_id: "plan", date: "2026-11-14", amount: 100 })];
    expect(installmentSchedule(plan, paidInNov, "2026-11-20").map((s) => s.status)).toEqual(["overdue", "completed", "upcoming"]);
    // A second payment in the same month, or one before the plan started, fills the earliest open step.
    const extra = [...paidInNov, txn({ installment_id: "plan", date: "2026-11-15", amount: 100 })];
    expect(installmentSchedule(plan, extra, "2026-11-20").map((s) => s.status)).toEqual(["completed", "completed", "upcoming"]);
    const early = [txn({ installment_id: "plan", date: "2026-09-30", amount: 100 })];
    expect(installmentSchedule(plan, early, "2026-11-20").map((s) => s.status)).toEqual(["completed", "due", "upcoming"]);
  });
});
