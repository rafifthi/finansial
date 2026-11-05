"use server";

import { z } from "zod";
import { accountOfCategory, pocketsOf } from "@/lib/finance/accounts";
import { bookAction } from "@/lib/data/action";
import { newId } from "@/lib/data/store";
import { TxnInput, writeTransaction } from "@/lib/data/transaction-write";
import { TABLES, type Transaction } from "@/lib/sheets/schema";

export type TxnInput = z.input<typeof TxnInput>;

export const saveTransaction = bookAction("data:write", TxnInput, async (input, ctx) => {
  await writeTransaction(input, ctx);
});

/** Saves several new transactions at once (Catat's confirmed drafts). */
export const saveTransactions = bookAction(
  "data:write",
  z.object({ transactions: z.array(TxnInput).min(1, "Nothing to save").max(200) }),
  async ({ transactions }, { user, store }) => {
    const now = new Date().toISOString();
    const [categories, settings] = await Promise.all([store.rows("categories"), store.settings()]);
    const pockets = pocketsOf(settings);
    await store.insert(
      "transactions",
      transactions.map((input) => {
        const accountOf = (id: string) => {
          const category = categories.find((c) => c.id === id);
          return category ? accountOfCategory(category, pockets) : "";
        };
        // Transfers run category to category, like the manual form.
        const transfer = input.type === "transfer";
        const account_id = transfer ? accountOf(input.from_category_id) : input.account_id || accountOf(input.category_id);
        return {
          ...input,
          id: newId(),
          account_id,
          from_category_id: transfer ? input.from_category_id : "",
          to_account_id: transfer ? accountOf(input.category_id) : "",
          recurring_id: "",
          created_at: now,
          updated_at: now,
          created_by: user.email,
          updated_by: user.email,
        };
      }),
    );
    return { count: transactions.length };
  },
);

/** Returns the removed rows so the client can offer Undo (restoreTransactions). */
export const deleteTransactions = bookAction("data:write", z.object({ ids: z.array(z.string()).min(1) }), async ({ ids }, { store }) => {
  const wanted = new Set(ids);
  const rows = (await store.rows("transactions")).filter((t) => wanted.has(t.id));
  await store.remove("transactions", ids);
  return rows;
});

/** Undo for deleteTransactions: re-inserts the rows with their original ids. */
export const restoreTransactions = bookAction(
  "data:write",
  z.object({ rows: z.array(z.record(z.string(), z.unknown())).min(1).max(500) }),
  async ({ rows }, { store }) => {
    const existing = new Set((await store.rows("transactions")).map((t) => t.id));
    const valid: Transaction[] = [];
    for (const row of rows) {
      const parsed = TABLES.transactions.schema.safeParse(row);
      if (parsed.success && !existing.has(parsed.data.id)) valid.push(parsed.data as Transaction);
    }
    if (valid.length) await store.insert("transactions", valid);
  },
);

export const setVerified = bookAction(
  "data:write",
  z.object({ ids: z.array(z.string()).min(1), verified: z.boolean() }),
  async ({ ids, verified }, { user, store }) => {
    const updated_at = new Date().toISOString();
    await store.updateMany("transactions", ids.map((key) => ({ key, patch: { verified, updated_at, updated_by: user.email } })));
  },
);

