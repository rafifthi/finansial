"use server";

import { z } from "zod";
import { bookAction } from "@/lib/data/action";
import { runRecurring } from "@/lib/data/recurring-job";
import { newId } from "@/lib/data/store";
import { PermissionError } from "@/auth";
import { can, TABLE_PERMISSION } from "@/lib/auth/roles";
import type { Role } from "@/lib/auth/roles";
import { accountOfCategory, accountUsage, isUsed, planAccountMerge, pocketKey, pocketsOf } from "@/lib/finance/accounts";
import { CATEGORY_GROUPS, TABLES } from "@/lib/sheets/schema";

const EDITABLE = ["accounts", "categories", "goals", "installments", "recurring"] as const;
type Editable = (typeof EDITABLE)[number];

/** Which other tables reference a row, so deletes can't orphan data. */
const REFERENCES: Record<Editable, { table: "transactions" | "categories" | "recurring" | "installments" | "budgets"; column: string }[]> = {
  // Accounts go through deleteAccount, which moves their rows elsewhere.
  accounts: [],
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
    if (table === "categories") {
      values.kind = values.group === "Income" ? "income" : "expense";
      // New categories start in their group's pocket.
      if (!id && !values.default_account_id) values.default_account_id = pocketsOf(await store.settings())[values.group as never] ?? "";
    }
    if ((table === "recurring" || table === "installments") && !values.account_id && values.category_id) {
      const category = (await store.rows("categories")).find((c) => c.id === values.category_id);
      values.account_id = category ? accountOfCategory(category, pocketsOf(await store.settings())) : "";
    }
    const parsed = def.schema.safeParse({ ...values, id: id || newId() });
    if (!parsed.success) throw new Error(parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
    if (id) await store.update(table, id, parsed.data as never);
    else await store.insert(table, [parsed.data as never]);
  },
);

export const deleteEntity = bookAction("data:write", z.object({ table: z.enum(EDITABLE), id: z.string().min(1) }), async ({ table, id }, { membership, store }) => {
  assertCanEdit(membership.role, table);
  if (table === "accounts") throw new Error("Delete accounts from the Accounts page so their transactions can be moved.");
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
  await store.remove(table, [id]);
});

/**
 * Deletes a money account. When anything still points at it, everything is
 * moved to `move_to` first (transactions, recurring, installments, category
 * defaults, group pockets) and `move_to` takes over its opening balance.
 */
export const deleteAccount = bookAction(
  "setup:write",
  z.object({ id: z.string().min(1), move_to: z.string().default("") }),
  async ({ id, move_to }, { store }) => {
    const accounts = await store.rows("accounts");
    const from = accounts.find((a) => a.id === id);
    if (!from) throw new Error("That account no longer exists.");
    const [transactions, recurring, installments, categories, settings] = await Promise.all([
      store.rows("transactions"),
      store.rows("recurring"),
      store.rows("installments"),
      store.rows("categories"),
      store.settings(),
    ]);
    const rows = { transactions, recurring, installments, categories, pockets: pocketsOf(settings) };

    if (move_to) {
      const to = accounts.find((a) => a.id === move_to);
      if (!to || to.id === from.id) throw new Error("Pick another account to move everything to.");
      const plan = planAccountMerge(from, to, rows);
      // Repoint first, drop the account last: a failure part-way leaves it in place to retry.
      await store.updateMany("transactions", plan.transactions.update);
      await store.remove("transactions", plan.transactions.remove);
      await store.updateMany("recurring", plan.recurring.update);
      await store.remove("recurring", plan.recurring.remove);
      await store.updateMany("installments", plan.installments);
      await store.updateMany("categories", plan.categories);
      for (const group of plan.pockets) await store.setSetting(pocketKey(group), to.id);
      if (from.opening_balance) await store.update("accounts", to.id, { opening_balance: plan.openingBalance });
    } else {
      if (isUsed(accountUsage(id, rows))) throw new Error("This account is still in use. Pick an account to move everything to.");
    }
    await store.remove("accounts", [id]);
  },
);

/** Shortcut: every category in the group moves to one account, which also becomes the default for new ones. */
export const setGroupPocket = bookAction(
  "setup:write",
  z.object({ group: z.enum(CATEGORY_GROUPS), account_id: z.string() }),
  async ({ group, account_id }, { store }) => {
    if (account_id && !(await store.rows("accounts")).some((a) => a.id === account_id)) throw new Error("That account no longer exists.");
    await store.setSetting(pocketKey(group), account_id);
    if (!account_id) return;
    const changes = (await store.rows("categories"))
      .filter((c) => c.group === group && c.default_account_id !== account_id)
      .map((c) => ({ key: c.id, patch: { default_account_id: account_id } }));
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
