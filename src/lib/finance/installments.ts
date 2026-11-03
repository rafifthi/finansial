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
