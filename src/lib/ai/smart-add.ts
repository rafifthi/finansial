import { z } from "zod";
import { TXN_TYPES, type Transaction } from "@/lib/sheets/schema";

/** A transaction the AI proposes; nothing is saved until the user confirms. */
export interface Draft {
  date: string;
  type: Transaction["type"];
  amount: number;
  /** For a transfer: the category the money goes to. */
  category_id: string;
  /** Transfers only: the category the money comes from. */
  from_category_id: string;
  account_id: string;
  to_account_id: string;
  description: string;
  member: string;
}

/** What the AI knows about the book it's drafting for. */
export interface BookContext {
  today: string;
  currency: string;
  categories: { id: string; name: string; group: string; kind: "expense" | "income" }[];
  accounts: { id: string; name: string; type: string }[];
  members: string[];
}

export interface Turn {
  role: "user" | "assistant";
  text: string;
}

/** A draft as the AI sees it on a follow-up: names instead of ids, so it survives switching books. */
export interface DraftForPrompt {
  date: string;
  type: string;
  amount: number;
  category: string;
  from_category: string;
  account: string;
  to_account: string;
  description: string;
  member: string;
}

export const SYSTEM = `You turn what a household member says, types, or photographs into transaction drafts for their finance book. They are in Indonesia; amounts are in rupiah unless stated.

Reading amounts:
- "35rb", "35 ribu", "35k" = 35000. "1,2jt", "1.2 juta" = 1200000. "goceng" = 5000, "ceban" = 10000, "gopek" = 500, "seceng" = 1000.
- Indonesian notation: "1.238.486" = 1238486, "22.760,00" = 22760.

Reading dates (relative to today): "tadi", "hari ini" = today; "kemarin" = yesterday; "lusa kemarin" = 2 days ago; a weekday means the most recent one. No date given means today.

Choosing fields:
- type: expense for spending, income for money coming in (gaji, refund, cashback), transfer for moving money from one of the user's categories to another (e.g. salary into a savings category).
- category_id and account_id must be ids from the lists given, or "" when unsure. Never invent ids.
- A transfer goes category to category: from_category_id is where the money comes from, category_id is where it goes. Leave account_id and to_account_id "" for transfers; each category's account is used.
- Payment words map to accounts: "pakai jago", "via gopay", "cash/tunai", "kartu kredit/cc", "jenius".
- member: a household member's name when the text says who spent it, else "".
- description: short and specific, like the merchant or item ("Nasi Padang", "Grab ke kantor").

Images:
- A receipt or struk is ONE transaction for its total (not each item), named after the shop, dated from the receipt.
- A transfer or payment screenshot is one transaction.
- A bill, statement or transaction list with many rows gives one draft per row.

Follow-ups: when current drafts are given, the message usually corrects them ("yang kedua Wants", "ganti tanggal kemarin", "hapus yang kopi"). Return the full updated list, keeping drafts the user didn't mention unchanged.

The reply is one short sentence in the user's language about what you drafted or changed. Nothing is saved until the user confirms, so never say it was recorded or saved ("dicatat", "disimpan"); say it's ready to check instead.

Reply with only JSON: {"reply": "<that sentence>", "drafts": [{"date":"YYYY-MM-DD","type":"expense","amount":35000,"category_id":"","from_category_id":"","account_id":"","to_account_id":"","description":"","member":""}]}
If the message isn't about money at all, return no drafts and say what you can help with.`;

export function buildPrompt(ctx: BookContext, turns: Turn[], drafts: DraftForPrompt[], remap: boolean): string {
  const book = {
    today: ctx.today,
    currency: ctx.currency,
    categories: ctx.categories.map((c) => ({ id: c.id, name: c.name, group: c.group, kind: c.kind })),
    accounts: ctx.accounts.map((a) => ({ id: a.id, name: a.name, type: a.type })),
    members: ctx.members,
  };
  const parts = [`Book (use only these ids):\n${JSON.stringify(book)}`];
  if (drafts.length) parts.push(`Current drafts (categories and accounts by name):\n${JSON.stringify(drafts)}`);
  if (remap) {
    parts.push("The user switched to this book. Keep every draft as it is, and re-pick category_id and account_id from this book's lists by matching names and meaning.");
  }
  if (turns.length) parts.push(`Conversation (latest last):\n${turns.map((t) => `${t.role === "user" ? "User" : "You"}: ${t.text}`).join("\n")}`);
  parts.push("Reply with only the JSON.");
  return parts.join("\n\n");
}

const RawReply = z.object({
  reply: z.string().catch(""),
  drafts: z
    .array(
      z.object({
        date: z.string().catch(""),
        type: z.string().catch("expense"),
        amount: z.coerce.number().catch(0),
        category_id: z.string().catch(""),
        from_category_id: z.string().catch(""),
        account_id: z.string().catch(""),
        to_account_id: z.string().catch(""),
        description: z.string().catch(""),
        member: z.string().catch(""),
      }),
    )
    .catch([]),
});

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Keeps the AI honest: only ids that exist in the book, a category of the
 * right kind, a plausible date, a positive whole amount.
 */
export function sanitizeReply(raw: unknown, ctx: BookContext): { reply: string; drafts: Draft[] } {
  const parsed = RawReply.safeParse(raw);
  if (!parsed.success) return { reply: "", drafts: [] };
  const categories = new Map(ctx.categories.map((c) => [c.id, c]));
  const accounts = new Set(ctx.accounts.map((a) => a.id));
  const members = new Set(ctx.members);
  const decimals = ctx.currency === "IDR" ? 0 : 2;

  const drafts = parsed.data.drafts.flatMap((d): Draft[] => {
    const amount = Math.abs(Number(d.amount.toFixed(decimals)));
    if (!amount) return [];
    const type = (TXN_TYPES as readonly string[]).includes(d.type) ? (d.type as Draft["type"]) : "expense";
    const category = categories.get(d.category_id);
    const categoryOk = category && (type === "transfer" || category.kind === (type === "income" ? "income" : "expense"));
    // Transfers run category to category; the server takes each category's account.
    const fromOk = type === "transfer" && categories.has(d.from_category_id) && d.from_category_id !== d.category_id;
    const account_id = type !== "transfer" && accounts.has(d.account_id) ? d.account_id : "";
    const to_account_id = "";
    return [
      {
        date: ISO.test(d.date) && d.date <= ctx.today ? d.date : ctx.today,
        type,
        amount,
        category_id: categoryOk ? d.category_id : "",
        from_category_id: fromOk ? d.from_category_id : "",
        account_id,
        to_account_id,
        description: d.description.trim().slice(0, 200),
        member: members.has(d.member) ? d.member : "",
      },
    ];
  });
  return { reply: parsed.data.reply.trim().slice(0, 300), drafts };
}
