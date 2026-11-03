"use server";

import { z } from "zod";
import { bookAction } from "@/lib/data/action";
import { runRecurring } from "@/lib/data/recurring-job";
import { newId } from "@/lib/data/store";
import { PermissionError } from "@/auth";
import { can, TABLE_PERMISSION } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";
import { TABLES } from "@/lib/sheets/schema";

const EDITABLE = ["accounts", "categories", "goals", "installments", "recurring"] as const;
type Editable = (typeof EDITABLE)[number];

/** Which other tables reference a row, so deletes can't orphan data. */
const REFERENCES: Record<Editable, { table: "transactions" | "categories" | "recurring" | "installments" | "budgets"; column: string }[]> = {
  accounts: [
    { table: "transactions", column: "account_id" },
    { table: "transactions", column: "to_account_id" },
  ],
  categories: [
    { table: "transactions", column: "category_id" },
    { table: "budgets", column: "category_id" },
  ],
  goals: [{ table: "categories", column: "goal_id" }],
  installments: [{ table: "transactions", column: "installment_id" }],
  recurring: [],
};

/** Money accounts and categories are admin-only; the rest is for members too. */
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
    if (table === "categories") values.kind = values.group === "Income" ? "income" : "expense";
    if ((table === "recurring" || table === "installments") && !values.account_id && values.category_id) {
      values.account_id = (await store.rows("categories")).find((c) => c.id === values.category_id)?.default_account_id ?? "";
    }
    const parsed = def.schema.safeParse({ ...values, id: id || newId() });
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
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
        table === "accounts" || table === "categories"
          ? `Still used by ${ref.table}. Archive it instead so history keeps its name.`
          : `Still referenced by ${ref.table}. Unlink those first.`,
      );
    }
  }
  await store.remove(table, [id]);
});

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
