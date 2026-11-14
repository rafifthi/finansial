"use server";

import { z } from "zod";
import { bookAction } from "@/lib/data/action";
import { newId } from "@/lib/data/store";
import { budgetMonth, closeMonthPlan, copyBudgets } from "@/lib/finance/budget";
import { savingsStore } from "@/lib/data/store";
import { pocketCarry, pocketsSince } from "@/lib/finance/pockets";
import { addMonths, today } from "@/lib/finance/dates";
import { normalizeCutoff, periodRange } from "@/lib/finance/period";

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

/**
 * Books the month-end plan as transfers: each pocket's balance (carried-over money
 * included) first covers the pockets that went over, and the rest moves to
 * `save_to`. Pockets in `keep` are left alone and carry into next month, leftover
 * or overspend. The plan is worked out here from the sheet's current rows, so a
 * stale screen can't double-book it.
 */
export const closeMonth = bookAction(
  "data:write",
  z.object({ month, save_to: z.string().default(""), keep: z.array(z.string()).default([]) }),
  async ({ month, save_to, keep }, { user, store, book }) => {
    const [budgets, categories, txns, settings, adjustments] = await Promise.all([
      store.rows("budgets"),
      store.rows("categories"),
      store.rows("transactions"),
      store.settings(),
      savingsStore(book).then((s) => s.rows("adjustments")),
    ]);
    const target = categories.find((c) => c.id === save_to);
    if (save_to && target?.group !== "Savings") throw new Error("Pick a Savings category to send the leftovers to.");
    const cutoff = normalizeCutoff(settings.cutoff_day);
    const { start, end } = periodRange(month, cutoff);
    const now = today();
    if (now < start) throw new Error("This period hasn't started yet.");

    const kept = new Set(keep);
    const pockets = pocketCarry({ month, since: pocketsSince(settings, month), budgets, categories, txns, adjustments, cutoff });
    const { lines } = budgetMonth({ month, budgets, categories, txns, cutoff, pockets });
    const moves = closeMonthPlan(
      lines.filter((l) => !kept.has(l.category.id)),
      save_to,
    );
    if (moves.length === 0) {
      throw new Error(kept.size ? "Nothing to move: every pocket you're not keeping is already at zero." : "Nothing to move: every pocket is already at zero.");
    }

    const name = (id: string) => categories.find((c) => c.id === id)?.name ?? "category";
    const date = now < end ? now : end;
    const stamp = new Date().toISOString();
    await store.insert(
      "transactions",
      moves.map((m) => ({
        id: newId(),
        date,
        type: "transfer" as const,
        amount: m.amount,
        category_id: m.to,
        from_category_id: m.from,
        member: "",
        description: m.reason === "cover" ? `Covers ${name(m.to)} overspend` : `Leftover from ${name(m.from)}`,
        verified: true,
        recurring_id: "",
        installment_id: "",
        created_at: stamp,
        updated_at: stamp,
        created_by: user.email,
        updated_by: user.email,
      })),
    );
    return { count: moves.length, saved: moves.filter((m) => m.reason === "save").reduce((s, m) => s + m.amount, 0) };
  },
);
