import "server-only";
import { today } from "@/lib/finance/dates";
import { dueTransactions } from "@/lib/finance/recurring";
import type { Book } from "@/lib/sheets/schema";
import { registry } from "./registry";
import { bookStore, newId } from "./store";

/**
 * Books every due occurrence of every recurring rule up to today, then moves
 * each rule's `last_run` forward. Safe to call repeatedly (cron + "Run now").
 */
export async function runRecurring(book: Book, now = today()) {
  const store = bookStore(book);
  const [rules, txns] = await Promise.all([store.rows("recurring"), store.rows("transactions")]);
  const created = rules.flatMap((rule) => dueTransactions(rule, txns, now, newId));
  await store.insert("transactions", created);
  await store.updateMany(
    "recurring",
    rules.filter((r) => r.last_run !== now && r.start_date <= now).map((r) => ({ key: r.id, patch: { last_run: now } })),
  );
  return { created: created.length };
}

/**
 * The daily cron: every active book, one at a time (they share one service
 * account's Sheets quota). A failing book is reported and skipped.
 */
export async function runRecurringForAllBooks(now = today()) {
  const books = (await registry().rows("books")).filter((b) => b.status === "active" && b.spreadsheet_id);
  const results: { book: string; created?: number; error?: string }[] = [];
  for (const book of books) {
    try {
      const { created } = await runRecurring(book, now);
      results.push({ book: book.id, created });
    } catch (err) {
      results.push({ book: book.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { books: results.length, created: results.reduce((s, r) => s + (r.created ?? 0), 0), results };
}
