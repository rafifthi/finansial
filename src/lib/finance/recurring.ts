import type { Recurring, Transaction } from "@/lib/sheets/schema";
import { addDays, addMonths, dayInMonth, monthOf, toUtc } from "./dates";

/** Occurrence dates of a rule within [from, to] inclusive. */
export function occurrences(rule: Recurring, from: string, to: string): string[] {
  const start = rule.start_date > from ? rule.start_date : from;
  const end = rule.end_date && rule.end_date < to ? rule.end_date : to;
  if (start > end) return [];
  const out: string[] = [];
  if (rule.frequency === "monthly") {
    for (let m = monthOf(start); m <= monthOf(end); m = addMonths(m, 1)) {
      const d = dayInMonth(m, rule.day);
      if (d >= start && d <= end) out.push(d);
    }
  } else {
    const offset = (rule.day - toUtc(start).getUTCDay() + 7) % 7;
    for (let d = addDays(start, offset); d <= end; d = addDays(d, 7)) out.push(d);
  }
  return out;
}

/**
 * Transactions a rule still owes up to `today`. Starts the day after
 * `last_run` (or at `start_date`) and skips any date that already has a
 * transaction for this rule, so running it twice never duplicates.
 */
export function dueTransactions(
  rule: Recurring,
  existing: Transaction[],
  today: string,
  newId: () => string,
  now = new Date().toISOString(),
): Transaction[] {
  const from = rule.last_run ? addDays(rule.last_run, 1) : rule.start_date;
  const booked = new Set(existing.filter((t) => t.recurring_id === rule.id).map((t) => t.date));
  return occurrences(rule, from, today)
    .filter((d) => !booked.has(d))
    .map((date) => ({
      id: newId(),
      date,
      type: rule.type,
      amount: rule.amount,
      category_id: rule.category_id,
      from_category_id: rule.from_category_id ?? "",
      member: rule.member,
      description: rule.description,
      verified: false,
      recurring_id: rule.id,
      installment_id: rule.installment_id,
      created_at: now,
      updated_at: now,
      created_by: "recurring",
      updated_by: "recurring",
    }));
}
