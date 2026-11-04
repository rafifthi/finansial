import "server-only";
import { can } from "@/lib/auth/roles";
import { booksOf } from "@/lib/data/registry";
import { bookStore } from "@/lib/data/store";
import type { Book, Installment, StatementLine, Transaction } from "@/lib/sheets/schema";

/**
 * Every transaction a bill can be checked against: the user's writable books,
 * not just the one the bill lives in (a card purchase may be recorded in the
 * Family book or a Personal one). Ids are book-qualified ("<bookId>:<txnId>")
 * so the matcher can treat the pool as one list.
 */
export interface PoolBook {
  book: Book;
  transactions: Transaction[];
  installments: Installment[];
  categoryName: Map<string, string>;
  accountName: Map<string, string>;
}

export interface TxnPool {
  books: Map<string, PoolBook>;
  /** Book-qualified copies, ready for candidatesFor/autoMatch. */
  transactions: Transaction[];
  installments: Pick<Installment, "id" | "name">[];
}

export const poolKey = (bookId: string, txnId: string) => `${bookId}:${txnId}`;

export function splitKey(key: string): { bookId: string; txnId: string } {
  const i = key.indexOf(":");
  return { bookId: key.slice(0, i), txnId: key.slice(i + 1) };
}

/** A line's linked transaction as a pool key ("" when unlinked). */
export const lineKey = (line: Pick<StatementLine, "transaction_id" | "transaction_book_id">, billBookId: string) =>
  line.transaction_id ? poolKey(line.transaction_book_id || billBookId, line.transaction_id) : "";

export async function loadPool(userId: string): Promise<TxnPool> {
  const access = (await booksOf(userId)).filter(
    (a) => a.book.status === "active" && a.book.spreadsheet_id && can(a.membership.role, "data:write"),
  );
  const loaded = await Promise.all(
    access.map(async ({ book }) => {
      try {
        const snap = await bookStore(book).snapshot();
        const rows = <K extends keyof typeof snap>(k: K) => snap[k].rows.map((r) => r.data) as (typeof snap)[K]["rows"][number]["data"][];
        return {
          book,
          transactions: rows("transactions"),
          installments: rows("installments"),
          categoryName: new Map(rows("categories").map((c) => [c.id, c.name])),
          accountName: new Map(rows("accounts").map((a) => [a.id, a.name])),
        } satisfies PoolBook;
      } catch (err) {
        // One unreachable sheet shouldn't hide the others.
        console.warn(`[bill-check] skipped book ${book.id}`, err);
        return null;
      }
    }),
  );
  const books = new Map(loaded.filter((b): b is PoolBook => b !== null).map((b) => [b.book.id, b]));
  const all = [...books.values()];
  return {
    books,
    transactions: all.flatMap((b) => b.transactions.map((t) => ({ ...t, id: poolKey(b.book.id, t.id) }))),
    installments: all.flatMap((b) => b.installments.map((i) => ({ id: i.id, name: i.name }))),
  };
}
