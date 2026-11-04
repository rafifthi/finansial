import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBookPage } from "@/auth";
import { BillActions, BillRows } from "@/components/app/bill-check";
import { Card } from "@/components/app/card";
import { PageHeader } from "@/components/app/page-header";
import { Meter } from "@/components/base/meter/meter";
import { formOptions, loadAppData } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { loadPool } from "@/lib/statements/pool";
import { lineViews, loadStatements, pickableTransactions, summarize } from "@/lib/statements/view";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Bill check" };

export default async function BillPage({ params }: PageProps<"/b/[bookId]/bill-check/[billId]">) {
  const { bookId, billId } = await params;
  const ctx = await requireBookPage(bookId);
  const data = await loadAppData(ctx);
  const [{ statements, lines }, pool] = await Promise.all([loadStatements(data), loadPool(ctx.user.id)]);
  const statement = statements.find((s) => s.id === billId);
  if (!statement) notFound();
  const own = lines.filter((l) => l.statement_id === statement.id);
  const s = summarize(statement, own);
  const fmt = (n: number) => formatMoney(n, data.money);
  const options = formOptions(data);
  const gap = statement.total_amount !== null ? statement.total_amount - s.linesTotal : 0;
  const rows = (n: number) => `${n} ${n === 1 ? "row" : "rows"}`;

  const tiles = [
    { label: "Bill total", value: fmt(s.billed), hint: statement.total_amount === null ? "Sum of the rows" : "From the bill" },
    { label: "Matched", value: fmt(s.matched), hint: `${s.lineCount - s.toCheck} of ${rows(s.lineCount)} settled` },
    {
      label: "Not found yet",
      value: fmt(s.balance),
      hint: s.toCheck ? `${rows(s.toCheck)} to check` : "Everything is accounted for",
      tone: s.balance ? "text-text-error-primary" : "text-status-lime-text",
    },
  ];

  return (
    <>
      <PageHeader
        title={statement.name}
        description={`Bill of ${new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${statement.statement_date}T00:00:00Z`))}${statement.status === "closed" ? " · done" : ""}`}
        actions={<BillActions statement={statement} options={options} toCheck={s.toCheck} />}
      />
      <Card>
        <dl className="grid gap-4 sm:grid-cols-3">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col gap-0.5">
              <dt className="text-body-2-regular text-text-tertiary">{t.label}</dt>
              <dd className={cx("text-title-3-semibold tabular-nums", t.tone ?? "text-text-primary")}>{t.value}</dd>
              <dd className="text-body-2-regular text-text-tertiary">{t.hint}</dd>
            </div>
          ))}
        </dl>
        <Meter aria-label="Rows settled" value={s.lineCount ? ((s.lineCount - s.toCheck) / s.lineCount) * 100 : 0} tone={s.toCheck ? "accent" : "success"} />
        {gap !== 0 ? (
          <p className="text-body-2-regular text-text-secondary">
            The rows add up to {fmt(s.linesTotal)}, {fmt(Math.abs(gap))} {gap > 0 ? "less" : "more"} than the bill total. A row may be missing.
          </p>
        ) : null}
      </Card>
      <BillRows
        views={lineViews(pool, statement, bookId, own, lines)}
        pickable={pickableTransactions(pool, statement, bookId, lines)}
        options={options}
      />
    </>
  );
}
