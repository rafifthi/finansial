import { parseAmount } from "@/lib/finance/money";
import type { LineKind } from "@/lib/sheets/schema";

export interface ParsedLine {
  /** YYYY-MM-DD, or "" when the line had no date. */
  date: string;
  description: string;
  /** Always positive; `kind` says whether it's a charge or a credit. */
  amount: number;
  kind: LineKind;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, mei: 5, jun: 6, jul: 7,
  aug: 8, agu: 8, agt: 8, sep: 9, oct: 10, okt: 10, nov: 11, dec: 12, des: 12,
};

const pad = (n: number) => String(n).padStart(2, "0");

/** Lines that are statement furniture rather than transactions. */
const SKIP =
  /^(total|sub ?total|balance|saldo|tagihan|minimum|pembayaran minimum|batas|limit|previous|new balance|jumlah|tanggal|transaction date|date|keterangan|description|item)\b/i;

const DATE_TOKEN = new RegExp(
  [
    String.raw`\d{4}-\d{1,2}-\d{1,2}`, // 2026-09-15
    String.raw`\d{1,2}[/.-]\d{1,2}(?:[/.-]\d{2,4})?`, // 15/09/2026, 15/09
    // 15 Sep 2026, 15-Okt-26; a 2-digit "year" followed by a month is the next date's day.
    String.raw`\d{1,2}[\s-](?:${Object.keys(MONTHS).join("|")})[a-z]*\.?(?:[\s-](?:\d{4}|\d{2}(?![\s-][a-z])))?`,
  ].join("|"),
  "i",
);

/**
 * Reads one date at the start of `text`. Missing years come from `anchor`
 * (the statement date): a month after the anchor's month belongs to the
 * previous year, as statements only list the past.
 */
function takeDate(text: string, anchor: string): { date: string; rest: string } | null {
  const m = text.match(new RegExp(`^(?:${DATE_TOKEN.source})(?=\\s|$)`, "i"));
  if (!m) return null;
  const token = m[0];
  const rest = text.slice(token.length).trim();
  const [ay, am] = anchor ? [Number(anchor.slice(0, 4)), Number(anchor.slice(5, 7))] : [new Date().getFullYear(), 12];
  const withYear = (d: number, mo: number, y?: number) => {
    if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return null;
    const year = y === undefined ? (mo > am ? ay - 1 : ay) : y < 100 ? 2000 + y : y;
    return { date: `${year}-${pad(mo)}-${pad(d)}`, rest };
  };

  let p = token.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (p) return withYear(+p[3], +p[2], +p[1]);
  p = token.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?$/);
  if (p) return withYear(+p[1], +p[2], p[3] ? +p[3] : undefined);
  p = token.match(/^(\d{1,2})[\s-]([a-z]+)\.?(?:[\s-](\d{2,4}))?$/i);
  if (p) {
    const mo = MONTHS[p[2].slice(0, 3).toLowerCase()];
    return mo ? withYear(+p[1], mo, p[3] ? +p[3] : undefined) : null;
  }
  return null;
}

// Amount at the end of the line, with an optional currency and credit marker.
const TRAILING_AMOUNT = /(-\s*)?(?:rp\.?|idr)?\s*(\(?-?\d[\d.,]*\)?)\s*(cr|kr|db|dr|-)?$/i;

/** Wording that marks a credit to the card, for rows typed by hand. */
export const looksLikeCredit = (description: string) =>
  /\b(pembayaran|payment|refund|cashback|reversal|pengembalian|cr)\b/i.test(description);

/** Classifies a statement line from its wording (Jenius and similar Indonesian cards). */
export function classifyLine(description: string, isCredit: boolean): LineKind {
  const d = description.toLowerCase();
  if (/\b(bunga|interest|finance charge)\b/.test(d)) return "interest";
  if (/\b(admin|biaya|fee|iuran|annual|tahunan|materai|meterai|denda|late charge|keterlambatan|bea)\b/.test(d)) return "fee";
  if (isCredit) return /\b(payment|pembayaran|bayar|autodebet|auto debit|transfer)\b/.test(d) ? "payment" : "refund";
  if (/\b\d{1,2}\s*\/\s*\d{1,2}\b|\b(cicilan|installment|instalment|flexi|cicil)\b/.test(d)) return "installment";
  return "charge";
}

/**
 * Turns pasted statement text into lines. Accepts what Jenius' e-statement
 * PDF gives when copied (`15 Sep 2026  16 Sep 2026  GRAB* A-7XYZ  JAKARTA
 * 20.000,00`, credits marked `CR`), its app's history, and a two-column
 * paste from a spreadsheet (`Item<TAB>Rp20,000<TAB>TRUE`).
 */
export function parseStatement(text: string, anchor = ""): ParsedLine[] {
  const out: ParsedLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // Spreadsheet pastes: drop checkbox columns and empty cells.
    let line = raw
      .split("\t")
      .map((c) => c.trim())
      .filter((c) => c && !/^(true|false|✓|✔)$/i.test(c))
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    if (!line) continue;

    const amountMatch = line.match(TRAILING_AMOUNT);
    if (!amountMatch) continue;
    const parsed = parseAmount(amountMatch[2]);
    if (parsed === undefined || parsed === 0) continue;
    line = line.slice(0, amountMatch.index).trim();
    // Some statements print a currency column before the amount.
    line = line.replace(/\s(?:idr|rp\.?)$/i, "").trim();

    let date = "";
    const first = takeDate(line, anchor);
    if (first) {
      date = first.date;
      line = first.rest;
      // Transaction date then posting date: keep the first, drop the second.
      const second = takeDate(line, anchor);
      if (second) line = second.rest;
    }

    const description = line.replace(/^[-–:|]\s*/, "").trim();
    if (!description || SKIP.test(description)) continue;

    const isCredit = Boolean(amountMatch[1]) || parsed < 0 || /^(cr|kr)$/i.test(amountMatch[3] ?? "");
    out.push({ date, description, amount: Math.abs(parsed), kind: classifyLine(description, isCredit) });
  }
  return out;
}

/** Whether a line adds to the bill (charges, installments, fees, interest) or reduces it. */
export const isCreditKind = (kind: LineKind) => kind === "payment" || kind === "refund";

/** The bill the lines add up to: charges minus refunds; card payments don't count. */
export function linesTotal(lines: Pick<ParsedLine, "amount" | "kind">[]): number {
  return lines.reduce((sum, l) => (l.kind === "payment" ? sum : sum + (isCreditKind(l.kind) ? -l.amount : l.amount)), 0);
}
