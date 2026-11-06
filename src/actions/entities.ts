"use server";

import { z } from "zod";
import { bookAction, FieldErrors, fieldErrorsFrom } from "@/lib/data/action";
import { runRecurring } from "@/lib/data/recurring-job";
import { newId } from "@/lib/data/store";
import { PermissionError } from "@/auth";
import { can, TABLE_PERMISSION } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";
import { transferErrors } from "@/lib/data/transaction-write";
import { orderCategories, rearrange, TABLES } from "@/lib/sheets/schema";

const EDITABLE = ["categories", "installments", "recurring"] as const;
type Editable = (typeof EDITABLE)[number];

/** Which other tables reference a row, so deletes can't orphan data. */
const REFERENCES: Record<Editable, { table: "transactions" | "categories" | "recurring" | "installments" | "budgets"; column: string }[]> = {
  categories: [
    { table: "transactions", column: "category_id" },
    { table: "transactions", column: "from_category_id" },
    { table: "budgets", column: "category_id" },
  ],
  installments: [{ table: "transactions", column: "installment_id" }],
  recurring: [],
};

/** Categories are admin-only; the rest is for members too. */
function assertCanEdit(role: Role, table: Editable) {
  if (!can(role, TABLE_PERMISSION[table])) throw new PermissionError("Your role doesn't allow this.");
}

export const saveEntity = bookAction(
  "data:write",
  z.object({ table: z.enum(EDITABLE), values: z.record(z.string(), z.unknown()) }),
  async ({ table, values }, { membership, store }) => {
    assertCanEdit(membership.role, table);
    const def = TABLES[table];
    const id = typeof values.id === "string" && values.id ? values.id : "";
    if (table === "categories") {
      values.kind = values.group === "Income" ? "income" : "expense";
      // Only a savings pot holds a balance or a target.
      if (values.group !== "Savings") {
        values.starting_balance = 0;
        values.target_amount = 0;
        values.target_date = "";
      }
      values.emoji = Array.from(String(values.emoji ?? "").trim()).slice(0, 8).join("");
      // A new category goes to the end of a reordered list; with no order set, the sheet's row order already does that.
      if (!id) {
        const top = Math.max(0, ...(await store.rows("categories")).map((c) => c.position));
        values.position = top ? top + 1 : 0;
      }
    }
    // Books created before a column existed (category emoji, starting balance) lack it in
    // the sheet; add it first so the write isn't silently dropped.
    const headers = (await store.snapshot())[table].headers.map(String);
    if (Object.keys(def.columns).some((c) => !headers.includes(c))) {
      await store.db.ensureSchema();
      store.invalidate();
    }
    if (table === "recurring") {
      if (values.type === "transfer") {
        const errors = transferErrors(await store.rows("categories"), String(values.from_category_id ?? ""), String(values.category_id ?? ""));
        if (Object.keys(errors).length) throw new FieldErrors(errors);
        values.installment_id = "";
      } else {
        values.from_category_id = "";
      }
    }
    const parsed = def.schema.safeParse({ ...values, id: id || newId() });
    if (!parsed.success) throw new FieldErrors(fieldErrorsFrom(parsed.error.issues));
    if (id) await store.update(table, id, parsed.data as never);
    else await store.insert(table, [parsed.data as never]);
  },
);

export const deleteEntity = bookAction("data:write", z.object({ table: z.enum(EDITABLE), id: z.string().min(1) }), async ({ table, id }, { membership, store }) => {
  assertCanEdit(membership.role, table);
  for (const ref of REFERENCES[table]) {
    const used = (await store.rows(ref.table)).some((r) => (r as Record<string, unknown>)[ref.column] === id);
    if (used) {
      throw new Error(
        table === "categories"
          ? `Still used by ${ref.table}. Archive it instead so history keeps its name.`
          : `Still referenced by ${ref.table}. Unlink those first.`,
      );
    }
  }
  const row = (await store.rows(table)).find((r) => r.id === id);
  await store.remove(table, [id]);
  return row as Record<string, unknown> | undefined;
});

/** Undo for deleteEntity: puts the removed row back with its original id. */
export const restoreEntity = bookAction(
  "data:write",
  z.object({ table: z.enum(EDITABLE), row: z.record(z.string(), z.unknown()) }),
  async ({ table, row }, { membership, store }) => {
    assertCanEdit(membership.role, table);
    const parsed = TABLES[table].schema.safeParse(row);
    if (!parsed.success) throw new Error("That item can't be restored.");
    if ((await store.rows(table)).some((r) => r.id === parsed.data.id)) return;
    await store.insert(table, [parsed.data as never]);
  },
);

/**
 * Saves a new category order. `ids` may be a subset (e.g. the Needs and Wants
 * lines shown on the dashboard): they're rearranged among the places they
 * already held, and every other category keeps its place.
 */
export const reorderCategories = bookAction(
  "setup:write",
  z.object({ ids: z.array(z.string().min(1)).min(1).max(500) }),
  async ({ ids }, { store }) => {
    const headers = (await store.snapshot()).categories.headers.map(String);
    if (!headers.includes("position")) {
      await store.db.ensureSchema();
      store.invalidate();
    }
    const order = orderCategories(await store.rows("categories"));
    const next = rearrange(order.map((c) => c.id), ids);
    const changes = next.flatMap((id, i) => (order.find((c) => c.id === id)!.position === i + 1 ? [] : [{ key: id, patch: { position: i + 1 } }]));
    await store.updateMany("categories", changes);
  },
);

export const saveSettings = bookAction(
  "setup:write",
  z.object({
    members: z.string().max(200),
    cutoff_day: z.coerce.number().int().min(1).max(31),
    currency: z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code like IDR"),
    locale: z.string().min(2).max(20),
  }),
  async (s, { store }) => {
    const members = s.members.split(",").map((m) => m.trim()).filter(Boolean).join(",");
    await store.setSetting("members", members);
    await store.setSetting("cutoff_day", String(s.cutoff_day));
    // Replaced by cutoff_day; drop the old key if an earlier version wrote it.
    if ((await store.rows("settings")).some((r) => r.key === "payday_day")) await store.remove("settings", ["payday_day"]);
    await store.setSetting("currency", s.currency);
    await store.setSetting("locale", s.locale);
  },
);

export const runRecurringNow = bookAction("data:write", z.object({}), async (_input, { book }) => {
  const { created } = await runRecurring(book);
  return { created };
});
