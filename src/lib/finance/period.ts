import { addDays, addMonths, dayInMonth, daysBetween, monthOf } from "./dates";

/**
 * Budget periods. Each period is labelled by a month ("2026-11") and ends on
 * the household's cut-off day; the next day starts the next period.
 *
 *   cut-off 31 (end of month) → calendar months
 *   cut-off 24                → "2026-11" runs 25 Oct – 24 Nov
 *
 * The cut-off is clamped to short months, so 30 means 28 Feb in February.
 */
export const END_OF_MONTH = 31;

export function normalizeCutoff(value: unknown): number {
  const n = Math.trunc(Number(value));
  return n >= 1 && n <= 31 ? n : END_OF_MONTH;
}

/** The period a date falls into. */
export function periodOf(isoDate: string, cutoff = END_OF_MONTH): string {
  const month = monthOf(isoDate);
  return isoDate > dayInMonth(month, cutoff) ? addMonths(month, 1) : month;
}

/** First and last day (inclusive) of a period. */
export function periodRange(period: string, cutoff = END_OF_MONTH): { start: string; end: string } {
  return { start: addDays(dayInMonth(addMonths(period, -1), cutoff), 1), end: dayInMonth(period, cutoff) };
}

/** Where `today` sits in its period, for the dashboard countdown. */
export function periodProgress(today: string, cutoff = END_OF_MONTH) {
  const period = periodOf(today, cutoff);
  const { start, end } = periodRange(period, cutoff);
  return { period, start, end, daysLeft: daysBetween(today, end), totalDays: daysBetween(start, end) + 1 };
}
