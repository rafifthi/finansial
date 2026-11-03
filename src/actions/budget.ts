"use server";

import { z } from "zod";
import { bookAction } from "@/lib/data/action";
import { newId } from "@/lib/data/store";
import { copyBudgets } from "@/lib/finance/budget";
import { addMonths } from "@/lib/finance/dates";

const month = z.string().regex(/^\d{4}-\d{2}$/);

/** Upserts one month's budget lines; a 0 amount removes the line. */
export const saveBudgets = bookAction(
  "data:write",
  z.object({
    month,
    items: z.array(z.object({ category_id: z.string().min(1), amount: z.number().nonnegative() })),
  }),
  async ({ month, items }, { store }) => {
    const existing = (await store.rows("budgets")).filter((b) => b.month === month);
    const byCategory = new Map(existing.map((b) => [b.category_id, b]));
    const toInsert = [];
    const toUpdate = [];
    const toRemove = [];
    for (const { category_id, amount } of items) {
      const current = byCategory.get(category_id);
      if (!current) {
        if (amount > 0) toInsert.push({ id: newId(), month, category_id, amount });
      } else if (amount === 0) toRemove.push(current.id);
      else if (amount !== current.amount) toUpdate.push({ key: current.id, patch: { amount } });
    }
    await store.updateMany("budgets", toUpdate);
    await store.insert("budgets", toInsert);
    await store.remove("budgets", toRemove);
  },
);

export const copyPreviousMonth = bookAction("data:write", z.object({ month }), async ({ month }, { store }) => {
  const budgets = await store.rows("budgets");
  const copied = copyBudgets(budgets, addMonths(month, -1), month, newId);
  if (copied.length === 0) throw new Error("Nothing to copy: last month has no budgets that aren't already set.");
  await store.insert("budgets", copied);
});
