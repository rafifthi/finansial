import "server-only";
import { today } from "@/lib/finance/dates";
import { normalizeCutoff, periodOf, periodProgress } from "@/lib/finance/period";
import type { MoneyFormat } from "@/lib/finance/money";
import type { Category } from "@/lib/sheets/schema";
import type { Book, Membership } from "@/lib/sheets/schema";
import { bookStore, savingsStore } from "./store";

/** Everything a book page needs from its spreadsheet, decoded once per request. */
export async function loadAppData({ book, membership }: { book: Book; membership: Membership }) {
  const store = bookStore(book);
  const [snap, settings] = await Promise.all([store.snapshot(), store.settings()]);
  const pick = <K extends keyof typeof snap>(k: K) => snap[k].rows.map((r) => r.data) as (typeof snap)[K]["rows"][number]["data"][];

  const categories = pick("categories");
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
    current: periodProgress(today(), normalizeCutoff(settings.cutoff_day)),
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

/** Reads `?m=YYYY-MM` (a budget period) with the current period as fallback. */
export function monthParam(value: string | string[] | undefined, fallback = periodOf(today())): string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
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
    installments: data.installments.map((i) => ({ id: i.id, name: i.name, monthly_amount: i.monthly_amount })),
    members: data.members,
    money: data.money,
    today: data.today,
  };
}

export type FormOptions = ReturnType<typeof formOptions>;
