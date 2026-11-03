/** Date helpers on plain ISO strings (YYYY-MM-DD / YYYY-MM), timezone-free. */

const pad = (n: number) => String(n).padStart(2, "0");

export const monthOf = (isoDate: string) => isoDate.slice(0, 7);

export function addMonths(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${pad((total % 12) + 1)}`;
}

/** Whole months from `from` to `to` (to − from), e.g. 2026-10 → 2027-01 = 3. */
export function monthDiff(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** The given day in a month, clamped to the month's last day (31 → 30 Apr). */
export function dayInMonth(month: string, day: number): string {
  return `${month}-${pad(Math.min(Math.max(day, 1), daysInMonth(month)))}`;
}

export function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function fromUtc(date: Date): string {
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function addDays(iso: string, days: number): string {
  const d = toUtc(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return fromUtc(d);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Today in the app's timezone (household is in Indonesia by default). */
export function today(timeZone = process.env.APP_TIMEZONE ?? "Asia/Jakarta"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

/** Last `count` months ending at `end`, oldest first. */
export function monthsEnding(end: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(end, i - count + 1));
}
