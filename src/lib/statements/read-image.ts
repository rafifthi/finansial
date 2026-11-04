import "server-only";
import { z } from "zod";
import { completeJson, type AiImage } from "@/lib/ai/client";

export { IMAGE_TYPES } from "@/lib/ai/client";
export type StatementImage = AiImage;

const Rows = z.object({
  rows: z.array(
    z.object({
      date: z.string().catch(""),
      name: z.string().catch(""),
      amount: z.coerce.number().catch(0),
      credit: z.boolean().catch(false),
    }),
  ),
});

export type ReadRow = z.infer<typeof Rows>["rows"][number];

const PROMPT = (referenceDate: string) => `These are screenshots of an Indonesian credit card bill or transaction list (usually the Jenius app or e-statement). Copy every transaction row.

Rules:
- One row per transaction, in the order shown, across all screenshots. A row that appears in two overlapping screenshots is copied once.
- Skip headers, balances, totals, minimum payment, credit limit and due date lines.
- Amounts use Indonesian notation: "1.238.486" is 1238486 and "22.760,00" is 22760. Give amount as a plain positive number.
- credit is true for payments, refunds, cashback and other credits (shown with CR, a plus sign, green text, or words like Pembayaran/Refund).
- date is YYYY-MM-DD, or "" when the row shows none. If a row shows day and month without a year, pick the year that keeps it on or before ${referenceDate}.

Reply with only JSON, no prose: {"rows":[{"date":"2026-09-01","name":"GRAB* A-7XYZ","amount":20000,"credit":false}]}`;

/** Turns bill screenshots into rows. Throws a user-readable error when it can't. */
export async function readStatementImages(images: StatementImage[], referenceDate: string): Promise<ReadRow[]> {
  const reply = await completeJson({ prompt: PROMPT(referenceDate), images });
  const parsed = Rows.safeParse(reply);
  if (!parsed.success) throw new Error("Couldn't make rows out of that screenshot. Try a sharper one or add rows by hand.");
  return parsed.data.rows.filter((r) => r.name.trim() && r.amount > 0);
}
