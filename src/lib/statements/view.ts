import "server-only";
import type { AppData } from "@/lib/data/app-data";
import { statementStore } from "@/lib/data/store";
import { addDays } from "@/lib/finance/dates";
import type { Statement, StatementLine, Transaction } from "@/lib/sheets/schema";
import { candidatesFor } from "./match";
import { isCreditKind, linesTotal } from "./parse";
import { lineKey, splitKey, type TxnPool } from "./pool";

/** A transaction as the statement screens show it. */
export interface TxnBrief {
  id: string;
  date: string;
  type: Transaction["type"];
  amount: number;
  description: string;
  categoryName: string;
  accountName: string;
  /** Set when the transaction lives in another book than the bill. */
  bookName: string;
}

export interface LineView {
  line: StatementLine;
  match?: TxnBrief;
  /** Best guesses for an unmatched line. */
  suggestions: TxnBrief[];
}

export interface StatementSummary {
  statement: Statement;
  lineCount: number;
  toCheck: number;
  /** The bank's figure when typed, else what the lines add up to. */
  billed: number;
  linesTotal: number;
  matched: number;
  /** Amount still unaccounted for: unmatched charges net of unmatched refunds. */
  balance: number;
}

const signed = (l: Pick<StatementLine, "amount" | "kind">) => (l.kind === "payment" ? 0 : isCreditKind(l.kind) ? -l.amount : l.amount);

export function summarize(statement: Statement, lines: StatementLine[]): StatementSummary {
  const total = linesTotal(lines);
  const sum = (pick: (l: StatementLine) => boolean) => lines.filter(pick).reduce((s, l) => s + signed(l), 0);
  return {
    statement,
    lineCount: lines.length,
    toCheck: lines.filter((l) => l.status === "unmatched").length,
    billed: statement.total_amount ?? total,
    linesTotal: total,
    matched: sum((l) => l.status === "matched"),
    balance: sum((l) => l.status === "unmatched"),
  };
}

export async function loadStatements(data: AppData) {
  const db = await statementStore(data.book);
  const [statements, lines] = await Promise.all([db.rows("statements"), db.rows("statement_lines")]);
  return { statements: statements.sort((a, b) => b.statement_date.localeCompare(a.statement_date)), lines };
}

/** A pool transaction ("<bookId>:<txnId>" id) as the screens show it. */
export function briefOf(pool: TxnPool, billBookId: string, t: Transaction): TxnBrief {
  const { bookId } = splitKey(t.id);
  const book = pool.books.get(bookId);
  return {
    id: t.id,
    date: t.date,
    type: t.type,
    amount: t.amount,
    description: t.description,
    categoryName: book?.categoryName.get(t.category_id) ?? "",
    accountName: book?.accountName.get(t.account_id) ?? "",
    bookName: bookId === billBookId ? "" : (book?.book.name ?? ""),
  };
}

/** Lines with their matched transaction and, when still open, suggestions from every book. */
export function lineViews(pool: TxnPool, statement: Statement, billBookId: string, lines: StatementLine[], allLines: StatementLine[]): LineView[] {
  const byKey = new Map(pool.transactions.map((t) => [t.id, t]));
  const taken = new Set(allLines.filter((l) => l.status === "matched").map((l) => lineKey(l, billBookId)));
  const open = pool.transactions.filter((t) => !taken.has(t.id));
  return lines
    .sort((a, b) => a.position - b.position)
    .map((line) => {
      const matched = line.transaction_id ? byKey.get(lineKey(line, billBookId)) : undefined;
      const suggestions =
        line.status === "unmatched"
          ? candidatesFor(line, statement.statement_date, open, pool.installments)
              .slice(0, 4)
              .map((c) => briefOf(pool, billBookId, c.transaction))
          : [];
      return { line, match: matched ? briefOf(pool, billBookId, matched) : undefined, suggestions };
    });
}

/** Unlinked transactions around the bill date, in every book, for picking a match by hand. */
export function pickableTransactions(pool: TxnPool, statement: Statement, billBookId: string, allLines: StatementLine[]): TxnBrief[] {
  const taken = new Set(allLines.filter((l) => l.status === "matched").map((l) => lineKey(l, billBookId)));
  const from = addDays(statement.statement_date, -90);
  const to = addDays(statement.statement_date, 10);
  return pool.transactions
    .filter((t) => t.type !== "transfer" && !taken.has(t.id) && t.date >= from && t.date <= to)
    .map((t) => briefOf(pool, billBookId, t));
}

/** A likely home for card fees and interest, by name. */
export function guessFeeCategory(data: AppData): string {
  const expense = data.categories.filter((c) => c.kind === "expense" && !c.archived);
  return (
    expense.find((c) => /\b(bank|card|cc|kartu)\b.*\b(fee|charge|biaya)s?\b|\b(admin|biaya|fee|bunga|interest)\b/i.test(c.name))?.id ?? ""
  );
}
