"use server";

import { z } from "zod";
import { bookAction, FieldErrors, fieldErrorsFrom } from "@/lib/data/action";
import { newId, savingsStore } from "@/lib/data/store";
import { planGoalMerge } from "@/lib/finance/savings";
import { SavingsAdjustmentSchema, type SavingsAdjustment } from "@/lib/sheets/schema";

/** Records a balance adjustment on a savings pot (interest, fees, a miscount). No transaction is written. */
export const saveAdjustment = bookAction(
  "data:write",
  z.object({ category_id: z.string().min(1), date: z.string(), amount: z.number(), note: z.string() }),
  async (input, { user, store, book }) => {
    const pot = (await store.rows("categories")).find((c) => c.id === input.category_id);
    if (!pot || pot.group !== "Savings") throw new Error("That savings pot no longer exists.");
    const parsed = SavingsAdjustmentSchema.safeParse({
      ...input,
      id: newId(),
      created_at: new Date().toISOString(),
      created_by: user.email,
    });
    if (!parsed.success) throw new FieldErrors(fieldErrorsFrom(parsed.error.issues));
    await (await savingsStore(book)).insert("adjustments", [parsed.data]);
  },
);

/** Returns the removed row so the client can offer Undo (restoreAdjustment). */
export const deleteAdjustment = bookAction("data:write", z.object({ id: z.string().min(1) }), async ({ id }, { book }) => {
  const store = await savingsStore(book);
  const row = (await store.rows("adjustments")).find((a) => a.id === id);
  await store.remove("adjustments", [id]);
  return row as SavingsAdjustment | undefined;
});

export const restoreAdjustment = bookAction("data:write", z.object({ row: z.record(z.string(), z.unknown()) }), async ({ row }, { book }) => {
  const parsed = SavingsAdjustmentSchema.safeParse(row);
  if (!parsed.success) throw new Error("That adjustment can't be restored.");
  const store = await savingsStore(book);
  if ((await store.rows("adjustments")).some((a) => a.id === parsed.data.id)) return;
  await store.insert("adjustments", [parsed.data]);
});

/**
 * One-time move of the old Goals onto their savings pots: each goal's target
 * and date go on its pot, and its "already saved" becomes the pot's starting
 * balance when the pot has none. The Goals tab itself is left as it was.
 */
export const mergeGoals = bookAction("setup:write", z.object({}), async (_input, { store }) => {
  const [goals, categories] = await Promise.all([store.rows("goals"), store.rows("categories")]);
  // Books from before pots had targets lack those columns; add them first.
  const headers = (await store.snapshot()).categories.headers.map(String);
  if (!headers.includes("target_amount") || !headers.includes("target_date") || !headers.includes("starting_balance")) {
    await store.db.ensureSchema();
    store.invalidate();
  }
  const plan = planGoalMerge(goals, categories, newId);
  await store.insert("categories", plan.filter((m) => m.isNew).map((m) => m.pot));
  await store.updateMany(
    "categories",
    plan.filter((m) => !m.isNew).map((m) => ({ key: m.pot.id, patch: m.patch })),
  );
  await store.setSetting("goals_merged", "true");
  return { count: plan.length };
});
