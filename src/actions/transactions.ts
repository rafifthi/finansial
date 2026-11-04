"use server";

import { z } from "zod";
import { accountOfCategory, overridesAllowed, pocketsOf } from "@/lib/finance/accounts";
import { bookAction, FieldErrors } from "@/lib/data/action";
import { newId } from "@/lib/data/store";
import { TABLES, TXN_TYPES, type Transaction } from "@/lib/sheets/schema";

const TxnInput = z
  .object({
    id: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    type: z.enum(TXN_TYPES),
    amount: z.number({ error: "Enter an amount" }).positive("Enter an amount"),
    /** For a transfer: the category the money goes to. */
    category_id: z.string().default(""),
    /** Transfers only: the category the money comes from. */
    from_category_id: z.string().default(""),
    account_id: z.string().default(""),
    to_account_id: z.string().default(""),
    member: z.string().default(""),
    description: z.string().trim().min(1, "Enter a description").max(200),
    verified: z.boolean().default(false),
    installment_id: z.string().default(""),
  })
  .refine((t) => t.type === "transfer" || t.category_id, { message: "Pick a category", path: ["category_id"] })
  .refine((t) => t.type !== "transfer" || t.from_category_id, { message: "Pick where the money comes from", path: ["from_category_id"] })
  .refine((t) => t.type !== "transfer" || t.category_id, { message: "Pick where the money goes", path: ["category_id"] })
  .refine((t) => t.type !== "transfer" || t.from_category_id !== t.category_id, {
    message: "Pick two different categories",
    path: ["category_id"],
  });

export type TxnInput = z.input<typeof TxnInput>;

export const saveTransaction = bookAction("data:write", TxnInput, async ({ id, ...input }, { user, store }) => {
  const now = new Date().toISOString();
  const settings = await store.settings();
  const categories = await store.rows("categories");
  const pockets = pocketsOf(settings);
  const accountOf = (categoryId: string) => {
    const category = categories.find((c) => c.id === categoryId);
    return category ? accountOfCategory(category, pockets) : "";
  };
  // Books made before transfers had a source category lack the column; add it first.
  const headers = (await store.snapshot()).transactions.headers.map(String);
  if (!headers.includes("from_category_id")) {
    await store.db.ensureSchema();
    store.invalidate();
  }

  let values: Omit<Transaction, "id" | "recurring_id" | "created_at" | "updated_at" | "created_by" | "updated_by">;
  if (input.type === "transfer") {
    // A transfer moves money between categories; each category's account says where it physically goes.
    const account_id = accountOf(input.from_category_id);
    const to_account_id = accountOf(input.category_id);
    if (!account_id) throw new FieldErrors({ from_category_id: "This category has no account yet. Set one in Settings → Categories." });
    if (!to_account_id) throw new FieldErrors({ category_id: "This category has no account yet. Set one in Settings → Categories." });
    values = { ...input, account_id, to_account_id, installment_id: "" };
  } else {
    let account_id = input.account_id;
    if (!overridesAllowed(settings)) {
      // The category decides the account. An edit that keeps its category keeps its account,
      // so balances of past transactions don't shift when the category's account changes later.
      const existing = id ? (await store.rows("transactions")).find((t) => t.id === id) : undefined;
      account_id = existing && existing.type !== "transfer" && existing.category_id === input.category_id ? existing.account_id : "";
    }
    if (!account_id) account_id = accountOf(input.category_id);
    values = { ...input, account_id, to_account_id: "", from_category_id: "" };
  }
  if (id) {
    await store.update("transactions", id, { ...values, updated_at: now, updated_by: user.email });
  } else {
    await store.insert("transactions", [
      { id: newId(), ...values, recurring_id: "", created_at: now, updated_at: now, created_by: user.email, updated_by: user.email },
    ]);
  }
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

