"use server";

import { z } from "zod";
import { accountOfCategory, overridesAllowed, pocketsOf } from "@/lib/finance/accounts";
import { bookAction } from "@/lib/data/action";
import { newId } from "@/lib/data/store";
import { TXN_TYPES } from "@/lib/sheets/schema";

const TxnInput = z
  .object({
    id: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    type: z.enum(TXN_TYPES),
    amount: z.number({ error: "Enter an amount" }).positive("Amount must be more than 0"),
    category_id: z.string().default(""),
    account_id: z.string().default(""),
    to_account_id: z.string().default(""),
    member: z.string().default(""),
    description: z.string().trim().max(200).default(""),
    verified: z.boolean().default(false),
    installment_id: z.string().default(""),
  })
  .refine((t) => t.type === "transfer" || t.category_id, { message: "Pick a category", path: ["category_id"] })
  .refine((t) => t.type !== "transfer" || (t.account_id && t.to_account_id && t.account_id !== t.to_account_id), {
    message: "Pick two different accounts for a transfer",
    path: ["to_account_id"],
  });

export type TxnInput = z.input<typeof TxnInput>;

export const saveTransaction = bookAction("data:write", TxnInput, async ({ id, ...input }, { user, store }) => {
  const now = new Date().toISOString();
  const settings = await store.settings();
  let account_id = input.account_id;
  if (input.type !== "transfer" && !overridesAllowed(settings)) {
    // The category decides the account. An edit that keeps its category keeps its account,
    // so balances of past transactions don't shift when the category's account changes later.
    const existing = id ? (await store.rows("transactions")).find((t) => t.id === id) : undefined;
    account_id = existing && existing.type !== "transfer" && existing.category_id === input.category_id ? existing.account_id : "";
  }
  if (!account_id && input.category_id) {
    const category = (await store.rows("categories")).find((c) => c.id === input.category_id);
    account_id = category ? accountOfCategory(category, pocketsOf(settings)) : "";
  }
  const values = { ...input, account_id, to_account_id: input.type === "transfer" ? input.to_account_id : "" };
  if (id) {
    await store.update("transactions", id, { ...values, updated_at: now, updated_by: user.email });
  } else {
    await store.insert("transactions", [
      { id: newId(), ...values, recurring_id: "", created_at: now, updated_at: now, created_by: user.email, updated_by: user.email },
    ]);
  }
});

export const deleteTransactions = bookAction("data:write", z.object({ ids: z.array(z.string()).min(1) }), ({ ids }, { store }) =>
  store.remove("transactions", ids),
);

export const setVerified = bookAction(
  "data:write",
  z.object({ ids: z.array(z.string()).min(1), verified: z.boolean() }),
  async ({ ids, verified }, { user, store }) => {
    const updated_at = new Date().toISOString();
    await store.updateMany("transactions", ids.map((key) => ({ key, patch: { verified, updated_at, updated_by: user.email } })));
  },
);

