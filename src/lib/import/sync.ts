/**
 * Resync from the old "Money Management V3" sheet: which of its transactions
 * a book doesn't have yet. Pure, like the importer. Import ids are derived
 * from each row's content, so a row already pulled in (even if edited here
 * since) is never offered again. Add-only: the old sheet clears its Spending
 * tab every month, so a row missing there says nothing about this book.
 */
import type { Category, Installment, Transaction } from "@/lib/sheets/schema";
import type { ImportPlan } from "./reference";

export interface SyncExisting {
  transactions: Pick<Transaction, "id" | "date" | "type" | "amount" | "description">[];
  categories: Category[];
  installments: Pick<Installment, "id">[];
}

export interface SyncCandidate {
  id: string;
  date: string;
  type: Transaction["type"];
  amount: number;
  description: string;
  categoryName: string;
  /** A transaction already in the book with the same date, type and amount (likely entered twice). */
  duplicateOf?: string;
  /** Why the row can't be added (it has no category in the old sheet). */
  problem?: string;
}

export interface SyncPreview {
  candidates: SyncCandidate[];
  /** Old-sheet rows this book already has. */
  alreadyThere: number;
}

/** The book's category for a planned one: same id, else same name. */
function categoryResolver(plan: ImportPlan, existing: SyncExisting) {
  const byId = new Map(existing.categories.map((c) => [c.id, c]));
  const byName = new Map(existing.categories.map((c) => [`${c.kind}:${c.name.trim().toLowerCase()}`, c]));
  const planned = new Map(plan.categories.map((c) => [c.id, c]));
  return (id: string) => {
    const p = planned.get(id);
    const own = byId.get(id) ?? (p ? byName.get(`${p.kind}:${p.name.trim().toLowerCase()}`) : undefined);
    return { own, planned: p };
  };
}

export function previewSync(plan: ImportPlan, existing: SyncExisting): SyncPreview {
  const have = new Set(existing.transactions.map((t) => t.id));
  const resolve = categoryResolver(plan, existing);
  const sameDay = new Map<string, string>();
  for (const t of existing.transactions) sameDay.set(`${t.date}|${t.type}|${t.amount}`, t.description || "a transaction");
  const fresh = plan.transactions.filter((t) => !have.has(t.id));
  const candidates = fresh
    .map((t): SyncCandidate => {
      const { own, planned } = resolve(t.category_id);
      return {
        id: t.id,
        date: t.date,
        type: t.type,
        amount: t.amount,
        description: t.description,
        categoryName: own?.name ?? planned?.name ?? "",
        duplicateOf: sameDay.get(`${t.date}|${t.type}|${t.amount}`),
        problem: t.category_id ? undefined : "No matching category in the old sheet",
      };
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.description.localeCompare(b.description));
  return { candidates, alreadyThere: plan.transactions.length - fresh.length };
}

/**
 * The rows to write for the picked ids: the transactions, pointed at this
 * book's categories, plus any category the book doesn't have yet.
 */
export function syncRows(plan: ImportPlan, ids: string[], existing: SyncExisting, now: string) {
  const wanted = new Set(ids);
  const have = new Set(existing.transactions.map((t) => t.id));
  const installments = new Set(existing.installments.map((i) => i.id));
  const resolve = categoryResolver(plan, existing);
  const added = new Map<string, Category>();

  const transactions: Transaction[] = [];
  for (const t of plan.transactions) {
    if (!wanted.has(t.id) || have.has(t.id) || !t.category_id) continue;
    const { own, planned } = resolve(t.category_id);
    let category = own ?? added.get(t.category_id);
    if (!category && planned) {
      // New in the old sheet since the import: bring the category over.
      category = { ...planned };
      added.set(planned.id, category);
    }
    if (!category) continue;
    transactions.push({
      ...t,
      category_id: category.id,
      installment_id: installments.has(t.installment_id) ? t.installment_id : "",
      created_at: now,
      updated_at: now,
    });
  }
  return { transactions, categories: [...added.values()] };
}
