import { describe, expect, it } from "vitest";
import type { Transaction } from "@/lib/sheets/schema";
import { autoMatch, candidatesFor, similarity } from "./match";
import { linesTotal, parseStatement } from "./parse";

const txn = (p: Partial<Transaction> & { id: string }): Transaction => ({
  date: "2026-09-10",
  type: "expense",
  amount: 0,
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

describe("parseStatement", () => {
  it("reads a spreadsheet paste (item, price, tick)", () => {
    const text = [
      "Ayam Pak Gembus\tRp20,000\tTRUE",
      "Motor 7/12\tRp1,238,486\tTRUE",
      "Admin Cc\tRp22,500\tTRUE",
      "Interest\tRp154,568\tTRUE",
      "tencent\tRp411,555\tFALSE",
      "\tRp9,007,725\tFALSE",
      "Balance\tRp1,791,270",
    ].join("\n");
    expect(parseStatement(text, "2026-09-25")).toEqual([
      { date: "", description: "Ayam Pak Gembus", amount: 20000, kind: "charge" },
      { date: "", description: "Motor 7/12", amount: 1238486, kind: "installment" },
      { date: "", description: "Admin Cc", amount: 22500, kind: "fee" },
      { date: "", description: "Interest", amount: 154568, kind: "interest" },
      { date: "", description: "tencent", amount: 411555, kind: "charge" },
    ]);
  });

  it("reads Jenius e-statement rows with two dates and CR credits", () => {
    const text = [
      "Transaction Date Posting Date Description Amount (IDR)",
      "28 Aug 2026 29 Aug 2026 SHOPEEFOOD JAKARTA 22.760,00",
      "01 Sep 02 Sep GRAB* A-7XYZ JAKARTA IDR 20.000",
      "05 Sep 2026 05 Sep 2026 PEMBAYARAN - TERIMA KASIH 5.000.000,00 CR",
      "10 Sep 2026 10 Sep 2026 REFUND TOKOPEDIA 75.000 CR",
      "20/09/2026 BIAYA MATERAI 10.000",
      "TOTAL TAGIHAN 9.007.725",
    ].join("\n");
    expect(parseStatement(text, "2026-09-25")).toEqual([
      { date: "2026-08-28", description: "SHOPEEFOOD JAKARTA", amount: 22760, kind: "charge" },
      { date: "2026-09-01", description: "GRAB* A-7XYZ JAKARTA", amount: 20000, kind: "charge" },
      { date: "2026-09-05", description: "PEMBAYARAN - TERIMA KASIH", amount: 5000000, kind: "payment" },
      { date: "2026-09-10", description: "REFUND TOKOPEDIA", amount: 75000, kind: "refund" },
      { date: "2026-09-20", description: "BIAYA MATERAI", amount: 10000, kind: "fee" },
    ]);
  });

  it("puts yearless December dates in the previous year for a January statement", () => {
    expect(parseStatement("28 Des NETFLIX 186.000", "2027-01-05")[0].date).toBe("2026-12-28");
  });

  it("totals charges minus refunds, ignoring card payments", () => {
    expect(
      linesTotal([
        { amount: 100, kind: "charge" },
        { amount: 10, kind: "fee" },
        { amount: 30, kind: "refund" },
        { amount: 500, kind: "payment" },
      ]),
    ).toBe(80);
  });
});

describe("matching", () => {
  it("scores description overlap", () => {
    expect(similarity("Gramedika PIM", "Gramedia Pondok Indah Mall")).toBeGreaterThan(0);
    expect(similarity("Netflix", "Spotify")).toBe(0);
  });

  it("matches on amount across any account or category, within the statement window", () => {
    const txns = [
      txn({ id: "a", amount: 20000, description: "Ayam", account_id: "jago", category_id: "food" }),
      txn({ id: "old", amount: 20000, date: "2026-06-01" }),
      txn({ id: "b", amount: 19999 }),
    ];
    const c = candidatesFor({ date: "", description: "Ayam Pak Gembus", amount: 20000, kind: "charge" }, "2026-09-25", txns);
    expect(c.map((x) => x.transaction.id)).toEqual(["a"]);
  });

  it("auto-matches unique and clearly-best candidates, never reusing a transaction", () => {
    const txns = [
      txn({ id: "t1", amount: 25000, description: "Shopee food" }),
      txn({ id: "t2", amount: 25000, description: "Shopee food" }),
      txn({ id: "t3", amount: 186000, description: "Netflix" }),
      txn({ id: "t4", amount: 65000, description: "Netflix Manda" }),
      txn({ id: "linked", amount: 319000, description: "Apple One" }),
    ];
    const lines = [
      { id: "l1", date: "", description: "Shopee food 29 Aug", amount: 25000, kind: "charge" as const },
      { id: "l2", date: "", description: "Netflix", amount: 186000, kind: "charge" as const },
      { id: "l3", date: "", description: "Netflix Manda", amount: 65000, kind: "charge" as const },
      { id: "l4", date: "", description: "Apple One", amount: 319000, kind: "charge" as const },
    ];
    const m = autoMatch(lines, "2026-09-25", txns, new Set(["linked"]));
    // Two identical Shopee rows are ambiguous: left for the user.
    expect(Object.fromEntries(m)).toEqual({ l2: "t3", l3: "t4" });
  });

  it("prefers the installment payment for an n/N line", () => {
    const txns = [
      txn({ id: "plain", amount: 1238486, description: "Bengkel" }),
      txn({ id: "inst", amount: 1238486, installment_id: "i1" }),
    ];
    const c = candidatesFor({ date: "", description: "Motor 7/12", amount: 1238486, kind: "installment" }, "2026-09-25", txns, [
      { id: "i1", name: "Cicilan Motor" },
    ]);
    expect(c[0].transaction.id).toBe("inst");
  });
});
