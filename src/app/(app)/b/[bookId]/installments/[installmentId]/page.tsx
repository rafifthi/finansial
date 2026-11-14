import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RiArrowLeftSLine, RiCheckboxCircleFill, RiErrorWarningFill, RiLinkM } from "@remixicon/react";
import { requireBookPage } from "@/auth";
import { Card } from "@/components/app/card";
import { EntityFormButton } from "@/components/app/entity-form";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { LinkPaymentsButton, PayInstallmentButton } from "@/components/app/pay-installment";
import { Meter } from "@/components/base/meter/meter";
import { formOptions, loadAppData } from "@/lib/data/app-data";
import { fieldSpecs } from "@/lib/data/field-specs";
import {
  installmentSchedule,
  installmentStatus,
  normalizeName,
  unlinkedPayments,
  type InstallmentStep,
  type StepStatus,
} from "@/lib/finance/installments";
import { formatMoney } from "@/lib/finance/money";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Installments" };

/** One installment: progress, then its schedule (paid, due this month, upcoming) step by step. */
export default async function InstallmentPage({ params }: PageProps<"/b/[bookId]/installments/[installmentId]">) {
  const { bookId, installmentId } = await params;
  const data = await loadAppData(await requireBookPage(bookId));
  const inst = data.installments.find((i) => i.id === installmentId);
  if (!inst) notFound();
  const s = installmentStatus(inst, data.transactions, data.today, data.cutoffDay);
  const fmt = (n: number) => formatMoney(n, data.money);
  const unlinked = s.isComplete ? [] : unlinkedPayments(inst, data.installments, data.transactions, data.cutoffDay);

  const steps = installmentSchedule(inst, data.transactions, data.today, data.cutoffDay);
  const offCount = steps.filter((st) => st.off !== 0).length;

  const tiles = [
    { label: "Total", value: fmt(s.total) },
    { label: "Paid", value: fmt(s.paidAmount) },
    { label: "Payments", value: `${s.paidCount} of ${inst.tenor_months}` },
    { label: "Per month", value: fmt(inst.monthly_amount) },
  ];

  return (
    <>
      <Link
        href={data.href("/installments")}
        className="-ms-1 flex w-fit items-center gap-0.5 rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <RiArrowLeftSLine className="size-4 rtl:-scale-x-100" aria-hidden />
        Installments
      </Link>
      <PageHeader
        title={inst.name}
        description={
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="text-title-2-medium text-text-primary tabular-nums">{fmt(s.remaining)}</span>
            <span className="text-body-2-regular text-text-tertiary">
              left · {s.isComplete ? "paid off" : `paid off in ${monthLabel(s.payoffMonth, "en-GB", "short")}`}
              {inst.note ? ` · ${inst.note}` : ""}
            </span>
          </span>
        }
        actions={
          <>
            <EntityFormButton
              table="installments"
              title="Installment"
              fields={fieldSpecs(data).installments}
              money={data.money}
              initial={inst}
              label="Edit"
            />
            {s.isDue ? <PayInstallmentButton installment={inst} options={formOptions(data)} /> : null}
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-4">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {tiles.map((t) => (
              <div key={t.label} className="flex flex-col gap-0.5">
                <dt className="text-body-2-regular text-text-tertiary">{t.label}</dt>
                <dd className="text-title-3-semibold text-text-primary tabular-nums">{t.value}</dd>
              </div>
            ))}
          </dl>
          <Meter
            aria-label={`${inst.name} paid`}
            value={s.total > 0 ? (s.paidAmount / s.total) * 100 : 0}
            tone={s.isComplete ? "success" : "accent"}
            size="sm"
          />
        </div>
      </Card>

      {unlinked.length ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-border-button-default px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <span className="flex items-start gap-2 text-body-2-regular text-text-secondary">
            <RiLinkM className="mt-0.5 size-4 shrink-0 text-foreground-icon-tertiary" aria-hidden />
            {unlinked.length} {unlinked.length === 1 ? "expense is" : "expenses are"} named “{inst.name}” but not linked, so{" "}
            {unlinked.length === 1 ? "it isn't" : "they aren't"} counted here yet.
          </span>
          <LinkPaymentsButton installmentId={inst.id} name={inst.name} count={unlinked.length} />
        </div>
      ) : null}

      <Card
        title="Schedule"
        description={
          offCount
            ? `${offCount} ${offCount === 1 ? "payment doesn't" : "payments don't"} match the ${fmt(inst.monthly_amount)} due (marked).`
            : `One step per month, ${fmt(inst.monthly_amount)} each.`
        }
      >
        <ol className="flex flex-col">
          {steps.map((st) => (
            <Step
              key={st.n}
              step={st}
              next={steps[st.n]}
              name={inst.name}
              amount={fmt(st.amount)}
              gap={st.off ? `${st.off > 0 ? "+" : "−"}${fmt(Math.abs(st.off))}` : ""}
              off={offText(st, fmt, inst.monthly_amount)}
              href={st.payment ? data.href(`/transactions?txn=${st.payment.id}`) : undefined}
            />
          ))}
        </ol>
      </Card>
    </>
  );
}

/** Who paid, plus the description when it says more than the installment's name. */
const detail = (t: { description: string; member: string }, name: string) =>
  [normalizeName(t.description) === normalizeName(name) ? "" : t.description, t.member].filter(Boolean).join(" · ");

const offText = (st: InstallmentStep, fmt: (n: number) => string, due: number) =>
  st.off ? `${fmt(Math.abs(st.off))} ${st.off > 0 ? "more" : "less"} than the ${fmt(due)} due` : "";

const STATUS: Record<StepStatus, string> = {
  completed: "Paid",
  due: "Due this month",
  overdue: "Overdue",
  upcoming: "",
};

/**
 * One instalment on the schedule: a numbered dot joined to the next by a line
 * (green once both are paid), the amount and its month. A paid step shows a
 * solid check instead of its number and links to its transaction.
 */
function Step({
  step,
  next,
  name,
  amount,
  gap,
  off,
  href,
}: {
  step: InstallmentStep;
  next?: InstallmentStep;
  /** The installment's name, to skip a description that just repeats it. */
  name: string;
  amount: string;
  /** "+Rp 50.000" (paid more) or "−Rp 50.000" (paid less); "" when it matches. */
  gap: string;
  /** Spelled-out version of the gap, for the icon's tooltip and screen readers. */
  off: string;
  href?: string;
}) {
  const done = step.status === "completed";
  const body = (
    <>
      <div className="flex min-w-0 flex-col pt-1">
        <span className="sr-only">Instalment {step.n}</span>
        <span
          className={cx(
            "flex flex-wrap items-center gap-x-1.5 text-body-medium tabular-nums",
            step.status === "upcoming" ? "text-text-tertiary" : step.status === "due" ? "text-body-semibold text-text-primary" : "text-text-primary",
          )}
        >
          {amount}
          {done && gap ? (
            <span className="flex items-center gap-1 text-body-2-medium text-text-negative" title={off}>
              <RiErrorWarningFill className="size-4" aria-hidden />
              {gap}
              <span className="sr-only">: {off}</span>
            </span>
          ) : null}
        </span>
        {done && step.payment && detail(step.payment, name) ? (
          <span className="truncate text-caption-1-regular text-text-tertiary">{detail(step.payment, name)}</span>
        ) : null}
      </div>
      <div className="flex shrink-0 flex-col items-end pt-1">
        <span className={cx("text-body-regular tabular-nums", step.status === "upcoming" ? "text-text-tertiary" : step.status === "due" ? "text-body-semibold text-text-primary" : "text-text-primary")}>
          {monthLabel(step.month, "en-GB", "short")}
        </span>
        {STATUS[step.status] ? (
          <span
            className={cx(
              "text-caption-1-medium",
              step.status === "due" ? "text-text-primary" : step.status === "overdue" ? "text-text-negative" : "text-text-tertiary",
            )}
          >
            {STATUS[step.status]}
          </span>
        ) : null}
      </div>
    </>
  );
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        {/* Paid: a solid check takes the number's place. */}
        {done ? (
          <RiCheckboxCircleFill className="size-8 shrink-0 text-text-positive" aria-hidden />
        ) : (
          <span
            className={cx(
              "flex size-8 shrink-0 items-center justify-center rounded-full text-body-2-semibold tabular-nums",
              // The one green on the schedule: the step you can act on now (flips forest/lime per theme).
              step.status === "due" && "bg-accent-solid text-on-accent",
              step.status === "overdue" && "bg-background-tertiary-default text-text-negative",
              // Upcoming steps look disabled, so this month's step stands out.
              step.status === "upcoming" && "border border-dashed border-border-button-default text-text-tertiary",
            )}
            aria-hidden
          >
            {step.n}
          </span>
        )}
        {next ? (
          <span aria-hidden className={cx("w-px flex-1", done && next.status === "completed" ? "bg-separator-border-strong" : "bg-separator-border")} />
        ) : null}
      </div>
      <div className={cx("min-w-0 flex-1", next ? "pb-3" : "")}>
        {href ? (
          <Link
            href={href}
            aria-label={`Instalment ${step.n}, ${amount}${gap ? `, ${off}` : ""}: open the transaction`}
            className="-mx-2 -mt-1 flex items-start justify-between gap-3 rounded-xl px-2 pb-1.5 pt-1 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
          >
            {body}
          </Link>
        ) : (
          <div
            className={cx(
              "flex items-start justify-between gap-3 pb-1.5",
              // This month's unpaid step sits on a soft band so it's the first thing you see.
              step.status === "due" && "-mx-2 -mt-1 rounded-xl bg-background-secondary-default px-2 pt-1",
            )}
          >
            {body}
          </div>
        )}
      </div>
    </li>
  );
}
