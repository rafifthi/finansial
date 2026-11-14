import type { Budget, Category, SavingsAdjustment, Transaction } from "@/lib/sheets/schema";
import { addMonths } from "./dates";
import { monthTotals, transferEffects } from "./ledger";
import { END_OF_MONTH, periodOf, periodRange } from "./period";

/**
 * Pockets: every Needs and Wants category keeps its own balance, like a savings
 * pot without a target. Each period's budget goes in, spending and budget moved
 * out come out, budget moved in and balance adjustments count too. What's left
 * at month end either goes to savings (Close the month) or stays and carries
 * into the next period.
 *
 * Pockets count from `pockets_since` (a budget period, set the first time the
 * book loads after this shipped). Earlier periods keep working as before: each
 * one stood alone, so their unclosed leftovers don't turn into balances.
 */
export const isPocket = (c: Pick<Category, "group">) => c.group === "Needs" || c.group === "Wants";

export const POCKETS_SINCE_KEY = "pockets_since";

/** First budget period pockets count from; the current one until a book has saved its own. */
export function pocketsSince(settings: Record<string, string>, current: string): string {
  const v = settings[POCKETS_SINCE_KEY] ?? "";
  return /^\d{4}-\d{2}$/.test(v) ? v : current;
}

type Adjustment = Pick<SavingsAdjustment, "category_id" | "date" | "amount">;

export interface PocketCarry {
  /** Balance brought into the period: earlier budgets minus what they used, plus earlier adjustments. */
  carried: number;
  /** Balance adjustments dated inside the period. */
  adjusted: number;
}

/** What each pocket brings into `month`, and what was adjusted during it. */
export function pocketCarry(input: {
  month: string;
  since: string;
  budgets: Pick<Budget, "month" | "category_id" | "amount">[];
  categories: Category[];
  txns: Transaction[];
  adjustments: Adjustment[];
  cutoff?: number;
}): Map<string, PocketCarry> {
  const { month, since, categories, txns, cutoff = END_OF_MONTH } = input;
  const out = new Map(categories.filter(isPocket).map((c) => [c.id, { carried: 0, adjusted: 0 }]));
  if (month < since) return out;

  for (let p = since; p < month; p = addMonths(p, 1)) {
    const used = monthTotals(txns, categories, p, cutoff).byCategory;
    for (const [id, carry] of out) carry.carried -= used.get(id) ?? 0;
  }
  for (const b of input.budgets) {
    const carry = out.get(b.category_id);
    if (carry && b.month >= since && b.month < month) carry.carried += b.amount;
  }
  const from = periodRange(since, cutoff).start;
  const { start, end } = periodRange(month, cutoff);
  for (const a of input.adjustments) {
    const carry = out.get(a.category_id);
    if (!carry || a.date < from || a.date > end) continue;
    if (a.date < start) carry.carried += a.amount;
    else carry.adjusted += a.amount;
  }
  return out;
}

export type PocketEntryKind = "budget" | "spent" | "moved-in" | "moved-out" | "adjustment";

export interface PocketEntry {
  /** Transaction, budget row or adjustment id. */
  id: string;
  date: string;
  kind: PocketEntryKind;
  /** Signed: what the entry did to the pocket. */
  amount: number;
  description: string;
  /** Moves: the category on the other side. */
  counterpart: string;
  /** Budget entries: the period they fund. */
  month: string;
  /** The pocket's balance right after this entry. */
  balance: number;
}

export interface PocketLedger {
  balance: number;
  /** Oldest first. */
  entries: PocketEntry[];
  totals: { budgeted: number; spent: number; in: number; out: number; adjusted: number };
}

/**
 * Every movement of one pocket from `since` through the end of `through` (the
 * current period), with a running balance. Ends at the same figure as
 * `pocketCarry` for the period after `through`.
 */
export function pocketLedger(
  pocket: Category,
  input: {
    since: string;
    through: string;
    budgets: Budget[];
    categories: Category[];
    txns: Transaction[];
    adjustments: (Adjustment & Pick<SavingsAdjustment, "id" | "note" | "created_at">)[];
    cutoff?: number;
  },
): PocketLedger {
  const { since, through, cutoff = END_OF_MONTH } = input;
  const catById = new Map(input.categories.map((c) => [c.id, c]));
  const name = (id: string) => catById.get(id)?.name ?? "";
  const from = periodRange(since, cutoff).start;
  const to = periodRange(through, cutoff).end;
  const inRange = (date: string) => date >= from && date <= to;
  // Budgets land first on their period's first day, before anything spent that day.
  const moves: (Omit<PocketEntry, "balance"> & { order: string })[] = [];

  for (const b of input.budgets) {
    if (b.category_id !== pocket.id || b.month < since || b.month > through || !b.amount) continue;
    moves.push({ id: b.id, date: periodRange(b.month, cutoff).start, order: "", kind: "budget", amount: b.amount, description: "", counterpart: "", month: b.month });
  }
  for (const t of input.txns) {
    if (!inRange(t.date)) continue;
    if (t.type === "transfer") {
      // transferEffects returns the change to the category's *used* amount; the pocket moves the other way.
      const used = transferEffects(t, catById).find(([id]) => id === pocket.id)?.[1];
      if (!used) continue;
      const incoming = used < 0;
      moves.push({
        id: t.id,
        date: t.date,
        order: t.created_at || "~",
        kind: incoming ? "moved-in" : "moved-out",
        amount: -used,
        description: t.description,
        counterpart: name(incoming ? t.from_category_id : t.category_id),
        month: "",
      });
    } else if (t.category_id === pocket.id) {
      moves.push({ id: t.id, date: t.date, order: t.created_at || "~", kind: "spent", amount: -t.amount, description: t.description, counterpart: "", month: "" });
    }
  }
  for (const a of input.adjustments) {
    if (a.category_id !== pocket.id || !inRange(a.date)) continue;
    moves.push({ id: a.id, date: a.date, order: a.created_at || "~", kind: "adjustment", amount: a.amount, description: a.note, counterpart: "", month: "" });
  }
  moves.sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order));

  let balance = 0;
  const totals = { budgeted: 0, spent: 0, in: 0, out: 0, adjusted: 0 };
  const entries: PocketEntry[] = [];
  for (const move of moves) {
    const { order, ...m } = move;
    void order;
    balance += m.amount;
    entries.push({ ...m, balance });
    if (m.kind === "budget") totals.budgeted += m.amount;
    else if (m.kind === "spent") totals.spent -= m.amount;
    else if (m.kind === "moved-in") totals.in += m.amount;
    else if (m.kind === "moved-out") totals.out -= m.amount;
    else totals.adjusted += m.amount;
  }
  return { balance, entries, totals };
}

/** The budget period an entry belongs to (budget entries say so themselves). */
export const entryPeriod = (e: Pick<PocketEntry, "date" | "month">, cutoff = END_OF_MONTH) => e.month || periodOf(e.date, cutoff);
