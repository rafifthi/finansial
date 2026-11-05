"use server";

import { z } from "zod";
import { PermissionError } from "@/auth";
import { provisionBook, rememberedOptions, type ProvisionOptions, type ProvisionResult } from "@/lib/books/provision";
import type { SheetVerification } from "@/lib/books/verify";
import { bookAction, userAction } from "@/lib/data/action";
import { registry } from "@/lib/data/registry";
import { bookStore, newId } from "@/lib/data/store";
import { normalizeCutoff } from "@/lib/finance/period";
import { loadImportPlan, usedSheetIds, verifyFor } from "@/lib/import/source";
import { monthTotals } from "@/lib/finance/ledger";
import { BOOK_KINDS, type Book } from "@/lib/sheets/schema";

/* ── New-book wizard ───────────────────────────────────────────────────────── */

const verify = verifyFor;

/** Live checklist while the user pastes a link. */
export const checkSheet = userAction(
  z.object({ input: z.string().max(500), purpose: z.enum(["book", "import"]), resumeBookId: z.string().optional() }),
  async ({ input, purpose, resumeBookId }, user): Promise<SheetVerification> => verify(user, input, purpose, resumeBookId),
);

export interface ImportPreview {
  title?: string;
  counts: Record<string, number>;
  months: { month: string; spent: number; income: number }[];
  warnings: string[];
}

/** Dry run of an import, so the user can compare totals with their old sheet before creating anything. */
export const previewImport = userAction(z.object({ input: z.string().max(500) }), async ({ input }, user): Promise<ImportPreview> => {
  const v = await verify(user, input, "import");
  if (!v.ok || !v.sheetId) throw new Error(v.checks.find((c) => c.status === "fail")?.detail ?? "That sheet can't be imported.");
  const plan = await loadImportPlan(v.sheetId);
  const months = [...new Set(plan.transactions.map((t) => t.date.slice(0, 7)))].sort();
  return {
    title: v.title,
    counts: {
      accounts: plan.accounts.length,
      categories: plan.categories.length,
      budgets: plan.budgets.length,
      transactions: plan.transactions.length,
      goals: plan.goals.length,
      installments: plan.installments.length,
    },
    months: months.map((month) => {
      const t = monthTotals(plan.transactions.filter((x) => !x.installment_id), plan.categories, month);
      return { month, spent: t.spent, income: t.income };
    }),
    warnings: plan.warnings,
  };
});

const CreateInput = z.object({
  name: z.string().trim().min(1, "Give the book a name").max(60),
  kind: z.enum(BOOK_KINDS),
  sheet: z.string().min(1, "Paste the link of your empty sheet"),
  start: z.enum(["fresh", "import"]),
  importSheet: z.string().optional(),
  cutoffDay: z.number().int().min(1).max(31),
});

export interface CreateBookResult {
  bookId: string;
  provision: ProvisionResult;
}

function provisionDeps(book: Book) {
  return { registry: registry(), store: bookStore(book), loadImportPlan };
}

/**
 * Re-runs every check (the sheet may have changed since the wizard showed
 * them), registers the book with the creator as admin, then provisions it.
 */
export const createBook = userAction(CreateInput, async (input, user): Promise<CreateBookResult> => {
  const used = await usedSheetIds();
  const target = await verify(user, input.sheet, "book", undefined, used);
  if (!target.ok || !target.sheetId) throw new Error(target.checks.find((c) => c.status === "fail")?.detail ?? "The sheet didn't pass the checks.");
  let importFrom: string | undefined;
  if (input.start === "import") {
    const source = await verify(user, input.importSheet ?? "", "import", undefined, used);
    if (!source.ok || !source.sheetId) throw new Error(source.checks.find((c) => c.status === "fail")?.detail ?? "The old sheet can't be imported.");
    if (source.sheetId === target.sheetId) throw new Error("The old sheet and the new book sheet must be different files.");
    importFrom = source.sheetId;
  }

  const now = new Date().toISOString();
  const book: Book = {
    id: newId(),
    name: input.name,
    kind: input.kind,
    icon: input.kind === "personal" ? "lock" : "home",
    spreadsheet_id: target.sheetId,
    owner_user_id: user.id,
    status: "provisioning",
    provision_step: "",
    migrated_from: importFrom ?? "",
    created_at: now,
  };
  await registry().insert("books", [book]);
  await registry().insert("memberships", [
    { id: newId(), book_id: book.id, user_id: user.id, role: "admin", member: "", last_opened_at: now, created_at: now },
  ]);

  const options: ProvisionOptions = {
    start: input.start,
    importFrom,
    cutoffDay: normalizeCutoff(input.cutoffDay),
    currency: "IDR",
    locale: "id-ID",
    claimedBy: user.email,
  };
  return { bookId: book.id, provision: await provisionBook(provisionDeps(book), book, options) };
});

/** Retries a half-finished book from the step that failed, with the choices saved in its sheet. */
export const resumeBook = userAction(z.object({ bookId: z.string().min(1) }), async ({ bookId }, user): Promise<CreateBookResult> => {
  const book = (await registry().fresh("books")).find((b) => b.id === bookId);
  if (!book || book.owner_user_id !== user.id) throw new PermissionError("Book not found.");
  if (book.status === "active") return { bookId, provision: { ok: true, completed: ["claim", "schema", "seed", "verify", "done"] } };

  const check = await verify(user, book.spreadsheet_id, "book", book.id);
  if (!check.ok) throw new Error(check.checks.find((c) => c.status === "fail")?.detail ?? "The sheet didn't pass the checks.");
  const remembered = await rememberedOptions(bookStore(book)).catch(() => ({}) as Partial<ProvisionOptions>);
  const options: ProvisionOptions = {
    start: remembered.start ?? (book.migrated_from ? "import" : "fresh"),
    importFrom: remembered.importFrom ?? (book.migrated_from || undefined),
    cutoffDay: normalizeCutoff(remembered.cutoffDay),
    currency: remembered.currency ?? "IDR",
    locale: remembered.locale ?? "id-ID",
    claimedBy: user.email,
  };
  return { bookId, provision: await provisionBook(provisionDeps(book), book, options) };
});

/** Deletes a book that never finished setting up (registry rows only; the spreadsheet is left alone). */
export const discardDraftBook = userAction(z.object({ bookId: z.string().min(1) }), async ({ bookId }, user) => {
  const book = (await registry().fresh("books")).find((b) => b.id === bookId);
  if (!book || book.owner_user_id !== user.id) throw new PermissionError("Book not found.");
  if (book.status === "active") throw new Error("This book is already in use. Archive it from Settings → Book instead.");
  const memberships = (await registry().fresh("memberships")).filter((m) => m.book_id === bookId).map((m) => m.id);
  await registry().remove("memberships", memberships);
  await registry().remove("books", [bookId]);
});

/* ── Existing books ────────────────────────────────────────────────────────── */

export const renameBook = bookAction("setup:write", z.object({ name: z.string().trim().min(1, "Give the book a name").max(60) }), async ({ name }, { book }) => {
  await registry().update("books", book.id, { name });
});

/** Hides the book for everyone. Owner only; the spreadsheet itself is untouched. */
export const archiveBook = bookAction("setup:write", z.object({ confirm: z.literal(true) }), async (_input, { book, user }) => {
  if (book.owner_user_id !== user.id) throw new PermissionError("Only the book's owner can archive it.");
  await registry().update("books", book.id, { status: "archived" });
});
