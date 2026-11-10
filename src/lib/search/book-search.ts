import { fold } from "@/lib/library/search";
import { periodOf } from "@/lib/finance/period";
import type { Category, Installment, Recurring, TodoItem, TodoList, Transaction } from "@/lib/sheets/schema";

/** The words typed, folded the way search compares them (case, accents and punctuation off). */
export const queryWords = (q: string) => fold(q).split(/\s+/).filter(Boolean);

/** True when every word appears somewhere in the text. */
export const hasAll = (text: string, words: string[]) => {
  const f = fold(text);
  return words.length > 0 && words.every((w) => f.includes(w));
};

export interface TxnHit {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: Transaction["type"];
  categoryName: string;
  categoryEmoji: string;
  /** The budget period it falls in, to open Transactions there. */
  period: string;
}

export interface CategoryHit {
  id: string;
  name: string;
  emoji: string;
  color: string;
  group: string;
}

export interface ListItemHit {
  listId: string;
  itemId: string;
  title: string;
  listName: string;
  listEmoji: string;
  done: boolean;
}

export interface PlanHit {
  kind: "recurring" | "installment";
  id: string;
  name: string;
}

export interface BookSearchData {
  transactions: Transaction[];
  categories: Category[];
  installments: Installment[];
  recurring: Recurring[];
  lists: TodoList[];
  items: TodoItem[];
  cutoffDay: number;
}

/**
 * The book's records matching every word: transactions (newest first, by
 * description or category), categories, list items (open ones first) and
 * recurring rules and installments. A few of each, for a quick list.
 */
export function searchBookData(q: string, data: BookSearchData, limit = 6) {
  const words = queryWords(q);
  if (!words.length) return { transactions: [], categories: [], items: [], plans: [] };
  const cat = new Map(data.categories.map((c) => [c.id, c]));

  const transactions: TxnHit[] = data.transactions
    .filter((t) => hasAll(`${t.description} ${cat.get(t.category_id)?.name ?? ""} ${t.member}`, words))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, limit)
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description,
      amount: t.amount,
      type: t.type,
      categoryName: cat.get(t.category_id)?.name ?? "",
      categoryEmoji: cat.get(t.category_id)?.emoji ?? "",
      period: periodOf(t.date, data.cutoffDay),
    }));

  const categories: CategoryHit[] = data.categories
    .filter((c) => !c.archived && hasAll(c.name, words))
    .slice(0, limit)
    .map((c) => ({ id: c.id, name: c.name, emoji: c.emoji, color: c.color, group: c.group }));

  const listById = new Map(data.lists.map((l) => [l.id, l]));
  const items: ListItemHit[] = data.items
    .filter((i) => listById.has(i.list_id) && hasAll(`${i.title} ${i.note}`, words))
    .sort((a, b) => Number(a.done) - Number(b.done))
    .slice(0, limit)
    .map((i) => ({ listId: i.list_id, itemId: i.id, title: i.title, listName: listById.get(i.list_id)!.name, listEmoji: listById.get(i.list_id)!.emoji, done: i.done }));

  const plans: PlanHit[] = [
    ...data.recurring.filter((r) => hasAll(r.description, words)).map((r) => ({ kind: "recurring" as const, id: r.id, name: r.description })),
    ...data.installments.filter((i) => hasAll(i.name, words)).map((i) => ({ kind: "installment" as const, id: i.id, name: i.name })),
  ].slice(0, limit);

  return { transactions, categories, items, plans };
}
