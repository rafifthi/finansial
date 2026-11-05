import type { Metadata } from "next";
import { requireBookPage } from "@/auth";
import { Card, EmptyState } from "@/components/app/card";
import { EntityFormButton } from "@/components/app/entity-form";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { PayInstallmentButton } from "@/components/app/pay-installment";
import { Chip } from "@/components/base/badges/chip";
import { Meter } from "@/components/base/meter/meter";
import { formOptions, loadAppData } from "@/lib/data/app-data";
import { fieldSpecs } from "@/lib/data/field-specs";
import { installmentStatus } from "@/lib/finance/installments";
import { formatMoney } from "@/lib/finance/money";

export const metadata: Metadata = { title: "Installments" };

export default async function InstallmentsPage({ params }: PageProps<"/b/[bookId]/installments">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const specs = fieldSpecs(data);
  const fmt = (n: number) => formatMoney(n, data.money);
  const options = formOptions(data);
  const statuses = data.installments
    .map((i) => installmentStatus(i, data.transactions, data.today, data.cutoffDay))
    .sort((a, b) => Number(a.isComplete) - Number(b.isComplete) || a.payoffMonth.localeCompare(b.payoffMonth));
  const monthlyLoad = statuses.filter((s) => !s.isComplete && s.currentIndex > 0).reduce((sum, s) => sum + s.installment.monthly_amount, 0);

  return (
    <>
      <PageHeader
        title="Installments"
        description={`Credit-card plans and loans. Committed this month: ${fmt(monthlyLoad)}`}
        actions={
          <EntityFormButton
            table="installments"
            title="Installment"
            fields={specs.installments}
            money={data.money}
            initial={{ start_month: data.current.period, tenor_months: 12, total_amount: 0 }}
          />
        }
      />
      {statuses.length === 0 ? (
        <Card>
          <EmptyState>Nothing here yet. Add your car loan or CC 0% plans.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {statuses.map((s) => {
            const i = s.installment;
            return (
              <Card
                key={i.id}
                title={i.name}
                description={i.note || undefined}
                action={<EntityFormButton table="installments" title="Installment" trigger="icon" fields={specs.installments} money={data.money} initial={i} />}
              >
                <div className="flex items-end justify-between gap-3">
                  <div className="flex flex-col">
                    <span className="text-display-4-medium text-text-primary tabular-nums">{fmt(s.remaining)}</span>
                    <span className="text-body-2-regular text-text-tertiary tabular-nums">left of {fmt(s.total)}</span>
                  </div>
                  {s.isComplete ? (
                    <Chip color="lime">Paid off</Chip>
                  ) : s.isDue ? (
                    <Chip color="yellow">Due this month</Chip>
                  ) : s.paidThisMonth ? (
                    <Chip color="lime">Paid this month</Chip>
                  ) : (
                    <Chip color="neutral">Starts {monthLabel(i.start_month, "en-GB", "short")}</Chip>
                  )}
                </div>
                <Meter aria-label={`${i.name} paid`} value={s.total > 0 ? (s.paidAmount / s.total) * 100 : 0} tone={s.isComplete ? "success" : "accent"} />
                <dl className="grid grid-cols-3 gap-3 text-body-2-regular">
                  <div className="flex flex-col">
                    <dt className="text-text-tertiary">Bulan ke-</dt>
                    <dd className="text-body-medium text-text-primary tabular-nums">
                      {s.currentIndex}/{i.tenor_months}
                    </dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-text-tertiary">Per month</dt>
                    <dd className="text-body-medium text-text-primary tabular-nums">{fmt(i.monthly_amount)}</dd>
                  </div>
                  <div className="flex flex-col">
                    <dt className="text-text-tertiary">Lunas</dt>
                    <dd className="text-body-medium text-text-primary">{monthLabel(s.payoffMonth, "en-GB", "short")}</dd>
                  </div>
                </dl>
                {s.isDue ? <PayInstallmentButton installment={i} options={options} /> : null}
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}
