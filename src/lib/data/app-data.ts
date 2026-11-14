import "server-only";
import { today } from "@/lib/finance/dates";
import { normalizeCutoff, periodOf, periodProgress } from "@/lib/finance/period";
import { POCKETS_SINCE_KEY, pocketCarry, pocketsSince } from "@/lib/finance/pockets";
import { installmentSchedule, installmentStatus } from "@/lib/finance/installments";
import type { MoneyFormat } from "@/lib/finance/money";
import { orderCategories, type Category } from "@/lib/sheets/schema";
import type { Book, Membership } from "@/lib/sheets/schema";
import { bookStore, savingsStore } from "./store";

/** Everything a book page needs from its spreadsheet, decoded once per request. */
export async function loadAppData({ book, membership }: { book: Book; membership: Membership }) {
  const store = bookStore(book);
  const [snap, settings] = await Promise.all([store.snapshot(), store.settings()]);
  const pick = <K extends keyof typeof snap>(k: K) => snap[k].rows.map((r) => r.data) as (typeof snap)[K]["rows"][number]["data"][];

  const categories = orderCategories(pick("categories"));
  const current = periodProgress(today(), normalizeCutoff(settings.cutoff_day));
  // Pockets count from the period a book first opened with them, so older unclosed
  // months don't turn into balances. Recorded once.
  if (!settings[POCKETS_SINCE_KEY]) {
    await store.setSetting(POCKETS_SINCE_KEY, current.period);
    settings[POCKETS_SINCE_KEY] = current.period;
  }
  const transactions = pick("transactions").sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  return {
    book,
    membership,
    /** Prefixes an in-book path: href("/budget") → "/b/<id>/budget". */
    href: (path = "") => `/b/${book.id}${path}`,
    categories,
    transactions,
    budgets: pick("budgets"),
    goals: pick("goals"),
    installments: pick("installments"),
    recurring: pick("recurring"),
    settings,
    money: { currency: settings.currency, locale: settings.locale } satisfies MoneyFormat,
    members: settings.members.split(",").map((m) => m.trim()).filter(Boolean),
    cutoffDay: normalizeCutoff(settings.cutoff_day),
    /** Current budget period ("YYYY-MM") and where today sits in it. */
    current,
    /** First period Needs/Wants pockets carry their balance from. */
    pocketsSince: pocketsSince(settings, current.period),
    today: today(),
    categoryById: new Map<string, Category>(categories.map((c) => [c.id, c])),
    invalidRows: Object.entries(snap).flatMap(([table, r]) => r.errors.map((e) => ({ table, ...e }))),
  };
}

export type AppData = Awaited<ReturnType<typeof loadAppData>>;

/** Savings balance adjustments (their own tab, created on first use). */
export async function loadAdjustments(data: Pick<AppData, "book">) {
  return (await savingsStore(data.book)).rows("adjustments");
}

/** Pocket balances brought into `month` (Needs/Wants), for budgetMonth's `pockets`. */
export function loadPockets(data: AppData, month: string, adjustments: Awaited<ReturnType<typeof loadAdjustments>>) {
  return pocketCarry({
    month,
    since: data.pocketsSince,
    budgets: data.budgets,
    categories: data.categories,
    txns: data.transactions,
    adjustments,
    cutoff: data.cutoffDay,
  });
}

/** Reads `?m=YYYY-MM` (a budget period) with the current period as fallback. */
export function monthParam(value: string | string[] | undefined, fallback = periodOf(today())): string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

export interface DescriptionSuggestion {
  text: string;
  type: "expense" | "income" | "transfer";
  /** The category it was booked to most often; the destination for a transfer. */
  category_id: string;
  from_category_id: string;
  count: number;
  /** Most recent amount, as a hint. */
  amount: number;
  last: string;
}

/**
 * Past descriptions for the form's autocomplete: one per wording and type, its
 * most used category, most used first. Transactions are newest first.
 */
function descriptionSuggestions(transactions: AppData["transactions"], limit = 400): DescriptionSuggestion[] {
  const byKey = new Map<string, DescriptionSuggestion & { cats: Map<string, number> }>();
  for (const t of transactions) {
    const text = t.description.trim().replace(/\s+/g, " ");
    if (!text) continue;
    const key = `${t.type}|${text.toLowerCase()}`;
    const found = byKey.get(key);
    const cat = `${t.category_id}|${t.from_category_id}`;
    if (found) {
      found.count += 1;
      found.cats.set(cat, (found.cats.get(cat) ?? 0) + 1);
    } else {
      byKey.set(key, { text, type: t.type, category_id: t.category_id, from_category_id: t.from_category_id, count: 1, amount: t.amount, last: t.date, cats: new Map([[cat, 1]]) });
    }
  }
  return [...byKey.values()]
    .map(({ cats, ...s }) => {
      const [category_id, from_category_id] = [...cats.entries()].sort((a, b) => b[1] - a[1])[0][0].split("|");
      return { ...s, category_id, from_category_id };
    })
    .sort((a, b) => b.count - a.count || b.last.localeCompare(a.last))
    .slice(0, limit);
}

/** Transactions per category over the last 90 days. */
function recentCategoryUse(transactions: { date: string; category_id: string }[], todayIso: string): Record<string, number> {
  const since = new Date(`${todayIso}T00:00:00Z`);
  since.setUTCDate(since.getUTCDate() - 90);
  const from = since.toISOString().slice(0, 10);
  const use: Record<string, number> = {};
  for (const t of transactions) if (t.category_id && t.date >= from) use[t.category_id] = (use[t.category_id] ?? 0) + 1;
  return use;
}

/** Lightweight option lists for client forms (no Maps, serialisable). */
export function formOptions(data: AppData) {
  return {
    categories: data.categories
      .filter((c) => !c.archived)
      .map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        group: c.group,
        emoji: c.emoji,
        color: c.color,
      })),
    /** How often each category was used lately, so quick capture can put the usual ones first. */
    categoryUse: recentCategoryUse(data.transactions, data.today),
    installments: data.installments.map((i) => {
      const s = installmentStatus(i, data.transactions, data.today, data.cutoffDay);
      const steps = installmentSchedule(i, data.transactions, data.today, data.cutoffDay);
      // A new payment settles this period's step if it's open, else the earliest open one.
      const open = steps.find((st) => st.status === "due") ?? steps.find((st) => st.status !== "completed");
      return {
        id: i.id,
        name: i.name,
        monthly_amount: i.monthly_amount,
        category_id: i.category_id,
        tenor_months: i.tenor_months,
        paidCount: s.paidCount,
        isComplete: s.isComplete,
        /** The instalment a new payment would settle. */
        nextStep: open?.n ?? Math.min(s.paidCount + 1, i.tenor_months),
        /** Which instalment each existing payment settled, by transaction id. */
        stepOf: Object.fromEntries(steps.flatMap((st) => (st.payment ? [[st.payment.id, st.n]] : []))) as Record<string, number>,
      };
    }),
    /** Past descriptions, most used first, for the description autocomplete. */
    descriptions: descriptionSuggestions(data.transactions),
    members: data.members,
    money: data.money,
    today: data.today,
  };
}

export type FormOptions = ReturnType<typeof formOptions>;
