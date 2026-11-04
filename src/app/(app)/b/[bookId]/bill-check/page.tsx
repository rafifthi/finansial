import type { Metadata } from "next";
import Link from "next/link";
import { requireBookPage } from "@/auth";
import { NewBillButton } from "@/components/app/bill-check";
import { Card, EmptyState } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Chip } from "@/components/base/badges/chip";
import { Meter } from "@/components/base/meter/meter";
import { formOptions, loadAppData } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { guessFeeCategory, loadStatements, summarize } from "@/lib/statements/view";

export const metadata: Metadata = { title: "Bill check" };

const longDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

export default async function BillCheckPage({ params }: PageProps<"/b/[bookId]/bill-check">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const { statements, lines } = await loadStatements(data);
  const fmt = (n: number) => formatMoney(n, data.money);
  const bills = statements.map((s) => summarize(s, lines.filter((l) => l.statement_id === s.id)));

  return (
    <>
      <PageHeader
        title="Bill check"
        description="Put in a credit card bill and see which rows are already in your records. Matched rows mark their transactions verified."
        actions={<NewBillButton options={formOptions(data)} feeCategoryId={guessFeeCategory(data)} />}
      />
      {bills.length === 0 ? (
        <Card>
          <EmptyState>No bills yet. Add this month&apos;s card bill to start.</EmptyState>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {bills.map((s) => {
            const done = s.lineCount - s.toCheck;
            return (
              <Link
                key={s.statement.id}
                href={data.href(`/bill-check/${s.statement.id}`)}
                className="rounded-3xl outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring"
              >
                <Card
                  title={s.statement.name}
                  description={longDate(s.statement.statement_date)}
                  action={
                    s.statement.status === "closed" ? (
                      <Chip color="lime">Done</Chip>
                    ) : s.toCheck ? (
                      <Chip color="yellow">{s.toCheck} to check</Chip>
                    ) : (
                      <Chip color="lime">All matched</Chip>
                    )
                  }
                  className="h-full hover:border-border-button-hover"
                >
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-display-4-medium text-text-primary tabular-nums">{fmt(s.balance)}</span>
                      <span className="text-body-2-regular text-text-tertiary tabular-nums">not found yet, of {fmt(s.billed)}</span>
                    </div>
                    <span className="text-body-2-regular text-text-tertiary tabular-nums">
                      {done}/{s.lineCount} rows
                    </span>
                  </div>
                  <Meter aria-label={`${s.statement.name} checked`} value={s.lineCount ? (done / s.lineCount) * 100 : 0} tone={s.toCheck ? "accent" : "success"} />
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
