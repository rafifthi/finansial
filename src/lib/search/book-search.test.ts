import { describe, expect, it } from "vitest";
import type { Category, Transaction, TodoItem, TodoList } from "@/lib/sheets/schema";
import { searchBookData } from "./book-search";

const cat = (id: string, name: string) => ({ id, name, emoji: "", color: "", group: "Needs", archived: false }) as Category;
const txn = (id: string, date: string, description: string, category_id: string) => ({ id, date, description, category_id, amount: 1000, type: "expense", member: "Kanza" }) as Transaction;

const data = {
  transactions: [txn("t1", "2026-10-02", "Indomaret snacks", "food"), txn("t2", "2026-11-05", "Indomaret milk", "food"), txn("t3", "2026-11-06", "PLN token", "bills")],
  categories: [cat("food", "Groceries"), cat("bills", "Electricity")],
  installments: [],
  recurring: [],
  lists: [{ id: "g", name: "Groceries", emoji: "🛒" } as TodoList],
  items: [{ id: "i1", list_id: "g", title: "Susu UHT", note: "Full cream", done: true } as TodoItem, { id: "i2", list_id: "g", title: "Susu kental", note: "", done: false } as TodoItem],
  cutoffDay: 25,
};

describe("searchBookData", () => {
  it("finds transactions by description or category, newest first, with their budget period", () => {
    const { transactions } = searchBookData("indomaret", data);
    expect(transactions.map((t) => t.id)).toEqual(["t2", "t1"]);
    expect(searchBookData("electricity", data).transactions.map((t) => t.id)).toEqual(["t3"]);
    // The 5th is before the cut-off on the 25th, so it's still in November's period.
    expect(transactions[0].period).toBe("2026-11");
  });

  it("finds categories and list items, open items first", () => {
    const r = searchBookData("susu", data);
    expect(r.items.map((i) => i.itemId)).toEqual(["i2", "i1"]);
    expect(searchBookData("groceries", data).categories.map((c) => c.id)).toEqual(["food"]);
  });

  it("returns nothing for an empty query", () => {
    expect(searchBookData("  ", data)).toEqual({ transactions: [], categories: [], items: [], plans: [] });
  });
});
