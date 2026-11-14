import type { Installment, Transaction } from "@/lib/sheets/schema";
import { addMonths, monthDiff } from "./dates";
import { END_OF_MONTH, periodOf } from "./period";

export interface InstallmentStatus {
  installment: Installment;
  /** Payments booked against this installment. */
  paidCount: number;
  paidAmount: number;
  total: number;
  remaining: number;
  /** Which instalment is due this month (1-based, "Bulan ke-"); 0 before start. */
  currentIndex: number;
  /** Month of the final instalment ("Lunas Bulan"). */
  payoffMonth: string;
  paidThisMonth: boolean;
  isComplete: boolean;
  /** Due this month and not yet paid. */
  isDue: boolean;
}

export function installmentStatus(inst: Installment, txns: Transaction[], today: string, cutoff = END_OF_MONTH): InstallmentStatus {
  const payments = txns.filter((t) => t.installment_id === inst.id);
  const paidAmount = payments.reduce((s, t) => s + t.amount, 0);
  const total = inst.total_amount > 0 ? inst.total_amount : inst.monthly_amount * inst.tenor_months;
  const thisMonth = periodOf(today, cutoff);
  const currentIndex = Math.min(Math.max(monthDiff(inst.start_month, thisMonth) + 1, 0), inst.tenor_months);
  const paidThisMonth = payments.some((t) => periodOf(t.date, cutoff) === thisMonth);
  const isComplete = paidAmount >= total || payments.length >= inst.tenor_months;
  return {
    installment: inst,
    paidCount: payments.length,
    paidAmount,
    total,
    remaining: Math.max(total - paidAmount, 0),
    currentIndex,
    payoffMonth: addMonths(inst.start_month, inst.tenor_months - 1),
    paidThisMonth,
    isComplete,
    isDue: !isComplete && currentIndex > 0 && !paidThisMonth,
  };
}

/** Lower-case words only, so "Cicilan  Mobil," and "cicilan mobil" compare equal. */
export function normalizeName(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * The installment a transaction description names: the same name, or the name
 * as whole words inside it ("Cicilan Mobil Nov"). Exact wins, then the longest
 * name, so "Cicilan Mobil Baru" beats "Cicilan Mobil". Finished ones never match.
 */
export function matchInstallment<I extends { id: string; name: string; isComplete?: boolean }>(description: string, installments: I[]): I | undefined {
  const text = normalizeName(description);
  if (!text) return undefined;
  let best: { inst: I; exact: boolean; length: number } | undefined;
  for (const inst of installments) {
    if (inst.isComplete) continue;
    const name = normalizeName(inst.name);
    if (!name) continue;
    const exact = text === name;
    if (!exact && !` ${text} `.includes(` ${name} `)) continue;
    if (!best || (exact && !best.exact) || (exact === best.exact && name.length > best.length)) best = { inst, exact, length: name.length };
  }
  return best?.inst;
}

/** Signed difference from what's due each month; 0 when it matches. */
export const dueDifference = (amount: number, inst: Pick<Installment, "monthly_amount">) => amount - inst.monthly_amount;

/** Payments booked against an installment whose amount isn't the monthly due, oldest first. */
export function mismatchedPayments(inst: Installment, txns: Transaction[]): Transaction[] {
  return txns
    .filter((t) => t.installment_id === inst.id && dueDifference(t.amount, inst) !== 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Expenses that name an installment but aren't linked to anything yet, from its
 * first month on: most likely its payments, recorded before linking was automatic.
 */
export function unlinkedPayments(inst: Installment, all: Installment[], txns: Transaction[], cutoff = END_OF_MONTH): Transaction[] {
  return txns
    .filter(
      (t) =>
        t.type === "expense" &&
        !t.installment_id &&
        periodOf(t.date, cutoff) >= inst.start_month &&
        matchInstallment(t.description, all)?.id === inst.id,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type StepStatus = "completed" | "due" | "overdue" | "upcoming";

export interface InstallmentStep {
  /** 1-based instalment number. */
  n: number;
  /** Budget period the instalment falls in. */
  month: string;
  status: StepStatus;
  /** The payment that settled it (completed steps). */
  payment?: Transaction;
  /** Paid amount when completed, else the monthly due. */
  amount: number;
  /** Paid minus due; 0 when it matches or isn't paid yet. */
  off: number;
}

/**
 * The installment as a schedule, one step per month. A payment settles the step
 * of the period it was paid in; one paid outside the plan's months, or a second
 * in the same month, settles the earliest open step. Every unpaid step is due
 * this period, overdue (an earlier period) or upcoming. Payments beyond the
 * tenor add steps so none go missing.
 */
export function installmentSchedule(inst: Installment, txns: Transaction[], today: string, cutoff = END_OF_MONTH): InstallmentStep[] {
  const payments = txns
    .filter((t) => t.installment_id === inst.id)
    .sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at));
  const current = periodOf(today, cutoff);
  const count = Math.max(inst.tenor_months, payments.length);
  const settled: (Transaction | undefined)[] = Array.from({ length: count });
  const leftover: Transaction[] = [];
  for (const t of payments) {
    const i = monthDiff(inst.start_month, periodOf(t.date, cutoff));
    if (i >= 0 && i < count && !settled[i]) settled[i] = t;
    else leftover.push(t);
  }
  for (const t of leftover) {
    const open = settled.findIndex((x) => !x);
    if (open >= 0) settled[open] = t;
  }
  return Array.from({ length: count }, (_, i) => {
    const month = addMonths(inst.start_month, i);
    const payment = settled[i];
    if (payment) return { n: i + 1, month, status: "completed", payment, amount: payment.amount, off: dueDifference(payment.amount, inst) };
    const status: StepStatus = month === current ? "due" : month < current ? "overdue" : "upcoming";
    return { n: i + 1, month, status, amount: inst.monthly_amount, off: 0 };
  });
}
