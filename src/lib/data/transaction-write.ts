import "server-only";
import { z } from "zod";
import { canTransfer } from "@/lib/finance/ledger";
import { FieldErrors, type BookActionContext } from "@/lib/data/action";
import { newId } from "@/lib/data/store";
import { TXN_TYPES, type Category, type Transaction } from "@/lib/sheets/schema";

export const TxnInput = z
  .object({
    id: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
    type: z.enum(TXN_TYPES),
    amount: z.number({ error: "Enter an amount" }).positive("Enter an amount"),
    /** For a transfer: the category the money goes to. */
    category_id: z.string().default(""),
    /** Transfers only: the category the money comes from. */
    from_category_id: z.string().default(""),
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

/** Field errors for a transfer's two categories: both must exist, differ, and not be income. */
export function transferErrors(categories: Category[], from: string, to: string): Record<string, string> {
  const errors: Record<string, string> = {};
  const check = (field: string, id: string, missing: string) => {
    const category = categories.find((c) => c.id === id);
    if (!id) errors[field] = missing;
    else if (category && !canTransfer(category)) errors[field] = "Income can't be moved. Pick a Needs, Wants or Savings category.";
  };
  check("from_category_id", from, "Pick where the money comes from");
  check("category_id", to, "Pick where the money goes");
  if (from && from === to) errors.category_id = "Pick two different categories";
  return errors;
}

/** Inserts or updates one transaction from the manual form; returns its id. */
export async function writeTransaction({ id, ...input }: z.infer<typeof TxnInput>, { user, store }: Pick<BookActionContext, "user" | "store">): Promise<string> {
  const now = new Date().toISOString();
  // Books made before transfers had a source category lack the column; add it first.
  const headers = (await store.snapshot()).transactions.headers.map(String);
  if (!headers.includes("from_category_id")) {
    await store.db.ensureSchema();
    store.invalidate();
  }

  if (input.type === "transfer") {
    const errors = transferErrors(await store.rows("categories"), input.from_category_id, input.category_id);
    if (Object.keys(errors).length) throw new FieldErrors(errors);
  }
  const values: Omit<Transaction, "id" | "recurring_id" | "created_at" | "updated_at" | "created_by" | "updated_by"> =
    input.type === "transfer" ? { ...input, installment_id: "" } : { ...input, from_category_id: "" };
  if (id) {
    await store.update("transactions", id, { ...values, updated_at: now, updated_by: user.email });
    return id;
  }
  const created = newId();
  await store.insert("transactions", [
    { id: created, ...values, recurring_id: "", created_at: now, updated_at: now, created_by: user.email, updated_by: user.email },
  ]);
  return created;
}
