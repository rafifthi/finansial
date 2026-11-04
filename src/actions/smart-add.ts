"use server";

import { z } from "zod";
import { completeJson, IMAGE_TYPES } from "@/lib/ai/client";
import { buildPrompt, sanitizeReply, SYSTEM, type BookContext, type Draft } from "@/lib/ai/smart-add";
import { bookAction } from "@/lib/data/action";
import { daysBetween, today } from "@/lib/finance/dates";
import { loadPool, splitKey } from "@/lib/statements/pool";

export interface DraftWithCheck extends Draft {
  /** An existing transaction that looks like this one, in any of the user's books. */
  duplicate?: { date: string; description: string; bookName: string };
}

/**
 * Drafts transactions for the book given as `bookId` from the conversation
 * so far, the images attached to the latest message, and the current drafts.
 */
export const draftWithAI = bookAction(
  "data:write",
  z.object({
    turns: z
      .array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(4000) }))
      .max(40),
    images: z
      .array(z.object({ media_type: z.enum(IMAGE_TYPES), data: z.string().min(1).max(4_000_000) }))
      .max(6, "Up to 6 images per message"),
    drafts: z
      .array(
        z.object({
          date: z.string(),
          type: z.string(),
          amount: z.number(),
          category: z.string(),
          from_category: z.string().default(""),
          account: z.string(),
          to_account: z.string(),
          description: z.string(),
          member: z.string(),
        }),
      )
      .max(200),
    /** The user switched books: re-pick categories and accounts for this one. */
    remap: z.boolean().default(false),
  }),
  async ({ turns, images, drafts, remap }, { store, user }) => {
    if (!turns.some((t) => t.role === "user" && t.text.trim()) && !images.length && !remap) {
      throw new Error("Type, say, or attach something to add.");
    }
    const [categories, accounts, settings] = await Promise.all([store.rows("categories"), store.rows("accounts"), store.settings()]);
    const ctx: BookContext = {
      today: today(),
      currency: settings.currency,
      categories: categories.filter((c) => !c.archived).map((c) => ({ id: c.id, name: c.name, group: c.group, kind: c.kind })),
      accounts: accounts.filter((a) => !a.archived).map((a) => ({ id: a.id, name: a.name, type: a.type })),
      members: settings.members
        .split(",")
        .map((m) => m.trim())
        .filter(Boolean),
    };

    const raw = await completeJson({ system: SYSTEM, prompt: buildPrompt(ctx, turns, drafts, remap), images });
    const { reply, drafts: next } = sanitizeReply(raw, ctx);

    // Flag anything already recorded: same type and amount within two days, in any book.
    const pool = await loadPool(user.id);
    const checked: DraftWithCheck[] = next.map((d) => {
      const twin = pool.transactions.find(
        (t) => t.type === d.type && t.amount === d.amount && Math.abs(daysBetween(t.date, d.date)) <= 2,
      );
      if (!twin) return d;
      const book = pool.books.get(splitKey(twin.id).bookId);
      return { ...d, duplicate: { date: twin.date, description: twin.description, bookName: book?.book.name ?? "" } };
    });
    return { reply, drafts: checked };
  },
);
