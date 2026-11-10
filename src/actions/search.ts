"use server";

import { z } from "zod";
import { bookAction } from "@/lib/data/action";
import { loadAppData } from "@/lib/data/app-data";
import { libraryStore, listStore } from "@/lib/data/store";
import { formatMoney } from "@/lib/finance/money";
import { searchPages } from "@/lib/library/search";
import { searchBookData } from "@/lib/search/book-search";

/**
 * Search across the whole book for the search box at the top of the
 * sidebar: Library pages, transactions, categories, list items, recurring
 * rules and installments. Every source is a cached read, so typing doesn't
 * cost extra Sheets requests.
 */
export const searchBook = bookAction(
  null,
  z.object({ q: z.string().max(200) }),
  async ({ q }, ctx) => {
    const [data, lists, library] = await Promise.all([
      loadAppData(ctx),
      listStore(ctx.book).then((s) => s.snapshot()),
      libraryStore(ctx.book).then((s) => s.snapshot()),
    ]);
    const found = searchBookData(q, {
      transactions: data.transactions,
      categories: data.categories,
      installments: data.installments,
      recurring: data.recurring,
      lists: lists.lists.rows.map((r) => r.data),
      items: lists.items.rows.map((r) => r.data),
      cutoffDay: data.cutoffDay,
    });
    return {
      ...found,
      transactions: found.transactions.map((t) => ({ ...t, amountLabel: formatMoney(t.amount, data.money) })),
      pages: searchPages(
        library.pages.rows.map((r) => r.data),
        library.blocks.rows.map((r) => r.data),
        q,
        6,
      ),
    };
  },
  { refresh: false },
);
