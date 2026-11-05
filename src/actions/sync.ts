"use server";

import { z } from "zod";
import { bookAction, type BookActionContext } from "@/lib/data/action";
import { registry } from "@/lib/data/registry";
import { pocketsOf } from "@/lib/finance/accounts";
import { parseSheetId } from "@/lib/books/verify";
import { loadImportPlan, verifyFor } from "@/lib/import/source";
import { previewSync, syncRows, type SyncCandidate } from "@/lib/import/sync";

/** Where the book was migrated from, or the sheet the user pasted (checked like the import wizard does). */
async function resolveSource(ctx: BookActionContext, input: string) {
  const pasted = input.trim();
  const current = ctx.book.migrated_from;
  if (!pasted || parseSheetId(pasted) === current) {
    if (!current) throw new Error("Paste the link of the old sheet to sync from.");
    return { sheetId: current, title: undefined as string | undefined };
  }
  const v = await verifyFor(ctx.user, pasted, "import");
  if (!v.ok || !v.sheetId) throw new Error(v.checks.find((c) => c.status === "fail")?.detail ?? "That sheet can't be read.");
  if (v.sheetId === ctx.book.spreadsheet_id) throw new Error("That's this book's own sheet. Paste the old tracker instead.");
  return { sheetId: v.sheetId, title: v.title };
}

async function existingRows(ctx: BookActionContext) {
  ctx.store.invalidate();
  const [transactions, categories, accounts, installments, settings] = await Promise.all([
    ctx.store.rows("transactions"),
    ctx.store.rows("categories"),
    ctx.store.rows("accounts"),
    ctx.store.rows("installments"),
    ctx.store.settings(),
  ]);
  return { existing: { transactions, categories, accounts, installments }, pockets: pocketsOf(settings) };
}


export interface ReferenceSyncPreview {
  sheetId: string;
  title?: string;
  candidates: SyncCandidate[];
  alreadyThere: number;
}

/** Reads the old sheet and lists the transactions this book doesn't have yet. Writes nothing. */
export const previewReferenceSync = bookAction(
  "data:write",
  z.object({ input: z.string().max(500).default("") }),
  async ({ input }, ctx): Promise<ReferenceSyncPreview> => {
    const source = await resolveSource(ctx, input);
    const [plan, { existing }] = await Promise.all([loadImportPlan(source.sheetId), existingRows(ctx)]);
    return { ...source, ...previewSync(plan, existing) };
  },
);

/** Adds the picked old-sheet transactions (and any category they need), then remembers the sheet for next time. */
export const applyReferenceSync = bookAction(
  "data:write",
  z.object({ input: z.string().max(500).default(""), ids: z.array(z.string().min(1)).min(1, "Pick at least one transaction").max(5000) }),
  async ({ input, ids }, ctx) => {
    const source = await resolveSource(ctx, input);
    const [plan, { existing, pockets }] = await Promise.all([loadImportPlan(source.sheetId), existingRows(ctx)]);
    const { transactions, categories } = syncRows(plan, ids, existing, pockets, new Date().toISOString());
    if (categories.length) await ctx.store.insert("categories", categories);
    if (transactions.length) await ctx.store.insert("transactions", transactions);
    if (ctx.book.migrated_from !== source.sheetId) await registry().update("books", ctx.book.id, { migrated_from: source.sheetId });
    return { added: transactions.length, categories: categories.length };
  },
);
