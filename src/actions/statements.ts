"use server";

import { z } from "zod";
import { accountOfCategory, pocketsOf } from "@/lib/finance/accounts";
import { requireBook } from "@/auth";
import { bookAction, type BookActionContext } from "@/lib/data/action";
import { bookStore, newId, statementStore } from "@/lib/data/store";
import { LINE_KINDS, type Statement, type StatementLine, type Transaction } from "@/lib/sheets/schema";
import { autoMatch } from "@/lib/statements/match";
import { lineKey, loadPool, splitKey } from "@/lib/statements/pool";
import { classifyLine } from "@/lib/statements/parse";
import { IMAGE_TYPES, readStatementImages } from "@/lib/statements/read-image";
import { TxnInput, writeTransaction } from "@/lib/data/transaction-write";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date");

const LineInput = z.object({
  date: z.union([isoDate, z.literal("")]).default(""),
  description: z.string().trim().min(1).max(200),
  amount: z.number().positive(),
  kind: z.enum(LINE_KINDS),
});

/** Pool keys ("<bookId>:<txnId>") of every transaction already linked to a line in this book's bills. */
async function linkedKeys(ctx: BookActionContext, except?: string) {
  const db = await statementStore(ctx.book);
  return new Set(
    (await db.fresh("statement_lines")).filter((l) => l.status === "matched" && l.transaction_id && l.id !== except).map((l) => lineKey(l, ctx.book.id)),
  );
}

/** What a line stores for a pool key: the bill's own book is kept as "". */
function linkFields(ctx: BookActionContext, key: string) {
  const { bookId, txnId } = splitKey(key);
  return { transaction_id: txnId, transaction_book_id: bookId === ctx.book.id ? "" : bookId };
}

/** Sets the verified flag on transactions in whichever books they live, checking write access to each. */
async function setVerified(ctx: BookActionContext, keys: string[], verified: boolean) {
  const byBook = new Map<string, string[]>();
  for (const key of keys.filter(Boolean)) {
    const { bookId, txnId } = splitKey(key);
    byBook.set(bookId, [...(byBook.get(bookId) ?? []), txnId]);
  }
  const updated_at = new Date().toISOString();
  for (const [bookId, ids] of byBook) {
    const store = bookId === ctx.book.id ? ctx.store : bookStore((await requireBook(bookId, "data:write")).book);
    const known = new Set((await store.fresh("transactions")).map((t) => t.id));
    const changes = ids.filter((id) => known.has(id)).map((key) => ({ key, patch: { verified, updated_at, updated_by: ctx.user.email } }));
    if (changes.length) await store.updateMany("transactions", changes);
  }
}

/** Creates a transaction for a statement line (fees, interest, or a forgotten purchase), verified. */
async function insertTxnForLine(
  ctx: BookActionContext,
  line: Pick<StatementLine, "date" | "description" | "amount" | "kind">,
  statementDate: string,
  categoryId: string,
  accountId: string,
): Promise<string> {
  const category = (await ctx.store.rows("categories")).find((c) => c.id === categoryId);
  if (!category) throw new Error("Pick a category");
  const pockets = pocketsOf(await ctx.store.settings());
  const now = new Date().toISOString();
  const id = newId();
  const credit = line.kind === "refund" || line.kind === "payment";
  const txn: Transaction = {
    id,
    date: line.date || statementDate,
    type: credit ? "income" : "expense",
    amount: line.amount,
    category_id: categoryId,
    account_id: accountId || accountOfCategory(category, pockets),
    to_account_id: "",
    from_category_id: "",
    member: "",
    description: line.description,
    verified: true,
    recurring_id: "",
    installment_id: "",
    created_at: now,
    updated_at: now,
    created_by: ctx.user.email,
    updated_by: ctx.user.email,
  };
  await ctx.store.insert("transactions", [txn]);
  return id;
}

/** Links what can be linked without asking; returns how many lines it matched. */
async function runAutoMatch(ctx: BookActionContext, statement: Statement): Promise<number> {
  const db = await statementStore(ctx.book);
  const lines = (await db.fresh("statement_lines")).filter((l) => l.statement_id === statement.id && l.status === "unmatched");
  if (!lines.length) return 0;
  ctx.store.invalidate();
  const [pool, taken] = await Promise.all([loadPool(ctx.user.id), linkedKeys(ctx)]);
  const matches = autoMatch(lines, statement.statement_date, pool.transactions, taken, pool.installments);
  if (!matches.size) return 0;
  await db.updateMany(
    "statement_lines",
    [...matches].map(([key, txnKey]) => ({ key, patch: { status: "matched" as const, ...linkFields(ctx, txnKey) } })),
  );
  await setVerified(ctx, [...matches.values()], true);
  return matches.size;
}

async function getStatement(ctx: BookActionContext, id: string) {
  const db = await statementStore(ctx.book);
  const statement = (await db.fresh("statements")).find((s) => s.id === id);
  if (!statement) throw new Error("Statement not found.");
  return { db, statement };
}

async function getLine(ctx: BookActionContext, lineId: string) {
  const db = await statementStore(ctx.book);
  const line = (await db.fresh("statement_lines")).find((l) => l.id === lineId);
  if (!line) throw new Error("Statement line not found.");
  const statement = (await db.rows("statements")).find((s) => s.id === line.statement_id);
  if (!statement) throw new Error("Statement not found.");
  return { db, line, statement };
}

export const createStatement = bookAction(
  "data:write",
  z.object({
    name: z.string().trim().min(1, "Name the statement").max(80),
    statement_date: isoDate,
    total_amount: z.number().nonnegative().nullable(),
    lines: z.array(LineInput).min(1, "Paste at least one statement line").max(500),
    /** Category for the fee and interest transactions created from the statement; "" skips them. */
    fee_category_id: z.string().default(""),
  }),
  async (input, ctx) => {
    const db = await statementStore(ctx.book);
    const now = new Date().toISOString();
    const statement: Statement = {
      id: newId(),
      name: input.name,
      statement_date: input.statement_date,
      total_amount: input.total_amount,
      status: "open",
      note: "",
      created_at: now,
      created_by: ctx.user.email,
    };
    await db.insert("statements", [statement]);

    const lines: StatementLine[] = [];
    for (const [position, l] of input.lines.entries()) {
      const line: StatementLine = { id: newId(), statement_id: statement.id, position, ...l, status: "unmatched", transaction_id: "", transaction_book_id: "" };
      if (l.kind === "payment") line.status = "ignored";
      else if ((l.kind === "fee" || l.kind === "interest") && input.fee_category_id) {
        line.transaction_id = await insertTxnForLine(ctx, l, statement.statement_date, input.fee_category_id, "");
        line.status = "matched";
      }
      lines.push(line);
    }
    await db.insert("statement_lines", lines);
    const matched = await runAutoMatch(ctx, statement);
    return { id: statement.id, matched };
  },
);

export const autoMatchStatement = bookAction("data:write", z.object({ id: z.string().min(1) }), async ({ id }, ctx) => {
  const { statement } = await getStatement(ctx, id);
  return { matched: await runAutoMatch(ctx, statement) };
});

export const updateStatement = bookAction(
  "data:write",
  z.object({
    id: z.string().min(1),
    name: z.string().trim().min(1, "Name the statement").max(80),
    statement_date: isoDate,
    total_amount: z.number().nonnegative().nullable(),
    status: z.enum(["open", "closed"]),
  }),
  async ({ id, ...patch }, ctx) => {
    const { db } = await getStatement(ctx, id);
    await db.update("statements", id, patch);
  },
);

export const deleteStatement = bookAction("data:write", z.object({ id: z.string().min(1) }), async ({ id }, ctx) => {
  const { db } = await getStatement(ctx, id);
  const lines = (await db.fresh("statement_lines")).filter((l) => l.statement_id === id);
  // The statement was the evidence for these ticks; take them back.
  await setVerified(ctx, lines.filter((l) => l.status === "matched").map((l) => lineKey(l, ctx.book.id)), false);
  if (lines.length) await db.remove("statement_lines", lines.map((l) => l.id));
  await db.remove("statements", [id]);
});

export const linkLine = bookAction(
  "data:write",
  /** `transactionKey` is a pool key: "<bookId>:<txnId>". */
  z.object({ lineId: z.string().min(1), transactionKey: z.string().regex(/^[^:]+:.+$/) }),
  async ({ lineId, transactionKey }, ctx) => {
    const { db, line } = await getLine(ctx, lineId);
    if ((await linkedKeys(ctx, lineId)).has(transactionKey)) throw new Error("That transaction is already matched to another bill row.");
    const previous = line.status === "matched" ? lineKey(line, ctx.book.id) : "";
    if (previous && previous !== transactionKey) await setVerified(ctx, [previous], false);
    await setVerified(ctx, [transactionKey], true);
    await db.update("statement_lines", lineId, { status: "matched", ...linkFields(ctx, transactionKey) });
  },
);

export const unlinkLine = bookAction("data:write", z.object({ lineId: z.string().min(1) }), async ({ lineId }, ctx) => {
  const { db, line } = await getLine(ctx, lineId);
  await setVerified(ctx, [lineKey(line, ctx.book.id)], false);
  await db.update("statement_lines", lineId, { status: "unmatched", transaction_id: "", transaction_book_id: "" });
});

export const ignoreLine = bookAction(
  "data:write",
  z.object({ lineId: z.string().min(1), ignored: z.boolean() }),
  async ({ lineId, ignored }, ctx) => {
    const { db, line } = await getLine(ctx, lineId);
    if (line.status === "matched") throw new Error("Unlink the transaction first.");
    await db.update("statement_lines", lineId, { status: ignored ? "ignored" : "unmatched" });
  },
);

/** Records a bill row that was never entered, from the full transaction form, and matches it. */
export const createFromLine = bookAction(
  "data:write",
  z.object({ lineId: z.string().min(1), transaction: TxnInput }),
  async ({ lineId, transaction }, ctx) => {
    const { db, line } = await getLine(ctx, lineId);
    if (line.status === "matched") throw new Error("This row is already matched.");
    // The bill is the evidence, so the new transaction starts verified.
    const transaction_id = await writeTransaction({ ...transaction, id: undefined, verified: true }, ctx);
    await db.update("statement_lines", lineId, { status: "matched", transaction_id, transaction_book_id: "" });
  },
);

/** Fixes a row's name after the bill is saved (a misread screenshot, a cryptic merchant). */
export const renameLine = bookAction(
  "data:write",
  z.object({ lineId: z.string().min(1), description: z.string().trim().min(1, "Enter a name").max(200) }),
  async ({ lineId, description }, ctx) => {
    const { db } = await getLine(ctx, lineId);
    await db.update("statement_lines", lineId, { description });
  },
);

/** Reads bill screenshots into rows for the user to check before saving. */
export const readScreenshots = bookAction(
  "data:write",
  z.object({
    images: z
      .array(z.object({ media_type: z.enum(IMAGE_TYPES), data: z.string().min(1).max(4_000_000) }))
      .min(1, "Add a screenshot")
      .max(6, "Up to 6 screenshots at a time"),
    reference_date: isoDate,
  }),
  async ({ images, reference_date }) => {
    const rows = await readStatementImages(images, reference_date);
    return rows.map((r) => ({
      date: /^\d{4}-\d{2}-\d{2}$/.test(r.date) ? r.date : "",
      description: r.name.trim().slice(0, 200),
      amount: Math.round(r.amount),
      kind: classifyLine(r.name, r.credit),
    }));
  },
);

/** Adds rows to an existing bill, then matches what it safely can. */
export const addLines = bookAction(
  "data:write",
  z.object({ id: z.string().min(1), lines: z.array(LineInput).min(1, "Add at least one row").max(500) }),
  async ({ id, lines }, ctx) => {
    const { db, statement } = await getStatement(ctx, id);
    const existing = (await db.fresh("statement_lines")).filter((l) => l.statement_id === id);
    const start = existing.reduce((max, l) => Math.max(max, l.position + 1), 0);
    await db.insert(
      "statement_lines",
      lines.map((l, i) => ({
        id: newId(),
        statement_id: id,
        position: start + i,
        ...l,
        status: l.kind === "payment" ? ("ignored" as const) : ("unmatched" as const),
        transaction_id: "",
        transaction_book_id: "",
      })),
    );
    return { matched: await runAutoMatch(ctx, statement) };
  },
);
