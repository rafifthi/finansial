import "server-only";
import { today } from "@/lib/finance/dates";
import { normalizeCutoff, periodOf, periodProgress } from "@/lib/finance/period";
import { accountOfCategory, overridesAllowed, pocketsOf } from "@/lib/finance/accounts";
import type { MoneyFormat } from "@/lib/finance/money";
import type { Account, Category } from "@/lib/sheets/schema";
import type { Book, Membership } from "@/lib/sheets/schema";
import { bookStore } from "./store";

/** Everything a book page needs from its spreadsheet, decoded once per request. */
export async function loadAppData({ book, membership }: { book: Book; membership: Membership }) {
  const store = bookStore(book);
  const [snap, settings] = await Promise.all([store.snapshot(), store.settings()]);
  const pick = <K extends keyof typeof snap>(k: K) => snap[k].rows.map((r) => r.data) as (typeof snap)[K]["rows"][number]["data"][];

  const accounts = pick("accounts");
  const categories = pick("categories");
  const transactions = pick("transactions").sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));

  return {
    book,
    membership,
    /** Prefixes an in-book path: href("/budget") → "/b/<id>/budget". */
    href: (path = "") => `/b/${book.id}${path}`,
    accounts,
    categories,
    transactions,
    budgets: pick("budgets"),
    goals: pick("goals"),
    installments: pick("installments"),
    recurring: pick("recurring"),
    settings,
    money: { currency: settings.currency, locale: settings.locale } satisfies MoneyFormat,
    /** Category group → the account its money is kept in ("" when unset). */
    pockets: pocketsOf(settings),
    /** Transactions may pick an account other than their category's (Settings → Categories). */
    accountOverride: overridesAllowed(settings),
    members: settings.members.split(",").map((m) => m.trim()).filter(Boolean),
    cutoffDay: normalizeCutoff(settings.cutoff_day),
    /** Current budget period ("YYYY-MM") and where today sits in it. */
    current: periodProgress(today(), normalizeCutoff(settings.cutoff_day)),
    today: today(),
    accountById: new Map<string, Account>(accounts.map((a) => [a.id, a])),
    categoryById: new Map<string, Category>(categories.map((c) => [c.id, c])),
    invalidRows: Object.entries(snap).flatMap(([table, r]) => r.errors.map((e) => ({ table, ...e }))),
  };
}

export type AppData = Awaited<ReturnType<typeof loadAppData>>;

/** Reads `?m=YYYY-MM` (a budget period) with the current period as fallback. */
export function monthParam(value: string | string[] | undefined, fallback = periodOf(today())): string {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}

/** Lightweight option lists for client forms (no Maps, serialisable). */
export function formOptions(data: AppData) {
  return {
    accounts: data.accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name, type: a.type, institution: a.institution })),
    categories: data.categories
      .filter((c) => !c.archived)
      .map((c) => ({
        id: c.id,
        name: c.name,
        kind: c.kind,
        group: c.group,
        emoji: c.emoji,
        color: c.color,
        default_account_id: accountOfCategory(c, data.pockets),
      })),
    installments: data.installments.map((i) => ({ id: i.id, name: i.name, monthly_amount: i.monthly_amount })),
    members: data.members,
    accountOverride: data.accountOverride,
    money: data.money,
    today: data.today,
  };
}

export type FormOptions = ReturnType<typeof formOptions>;
