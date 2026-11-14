import Link from "next/link";
import { RiArrowLeftSLine } from "@remixicon/react";
import { Card } from "@/components/app/card";
import { CategoryIcon } from "@/components/app/category-icon";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { AdjustBalanceButton, DeleteAdjustmentButton } from "@/components/app/savings-adjust";
import { Meter } from "@/components/base/meter/meter";
import { can } from "@/lib/auth/roles";
import { loadAdjustments, loadPockets, type AppData } from "@/lib/data/app-data";
import { budgetMonth } from "@/lib/finance/budget";
import { formatMoney } from "@/lib/finance/money";
import { entryPeriod, pocketLedger, type PocketEntry } from "@/lib/finance/pockets";
import type { Category } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";
import { usageTone } from "@/components/app/budget-bar";

const label = (e: PocketEntry) =>
  e.kind === "budget"
    ? `Budget for ${monthLabel(e.month)}`
    : e.kind === "spent"
      ? "Spent"
      : e.kind === "moved-in"
        ? `From ${e.counterpart || "?"}`
        : e.kind === "moved-out"
          ? `To ${e.counterpart || "?"}`
          : "Adjustment";

/** A Needs/Wants pocket: this period at a glance, then every movement with the balance after it. */
export async function SpendingPocket({ data, pocket }: { data: AppData; pocket: Category }) {
  const adjustments = await loadAdjustments(data);
  const period = data.current.period;
  const since = data.pocketsSince;

  const ledger = pocketLedger(pocket, {
    since,
    through: period,
    budgets: data.budgets,
    categories: data.categories,
    txns: data.transactions,
    adjustments,
    cutoff: data.cutoffDay,
  });
  const line = budgetMonth({
    month: period,
    budgets: data.budgets,
    categories: data.categories,
    txns: data.transactions,
    cutoff: data.cutoffDay,
    pockets: loadPockets(data, period, adjustments),
  }).lines.find((l) => l.category.id === pocket.id);

  const canWrite = can(data.membership.role, "data:write");
  const fmt = (n: number) => formatMoney(n, data.money);
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
  const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  // Newest first, grouped by budget period.
  const groups: { month: string; end: number; entries: PocketEntry[] }[] = [];
  for (const e of [...ledger.entries].reverse()) {
    const month = entryPeriod(e, data.cutoffDay);
    const group = groups.at(-1);
    if (group?.month === month) group.entries.push(e);
    else groups.push({ month, end: e.balance, entries: [e] });
  }

  const carried = (line?.carried ?? 0) + (line?.adjusted ?? 0);
  const tiles = [
    { label: `Carried into ${monthLabel(period)}`, value: signed(line?.carried ?? 0) },
    { label: "Budget this period", value: fmt(line?.budget ?? 0) },
    { label: "Spent so far", value: fmt(line?.spent ?? 0) },
    { label: "Adjusted this period", value: signed(line?.adjusted ?? 0) },
  ];
  // Real spending only; what went to savings or other pockets is named in the caption.
  const usage = line && line.available > 0 ? line.spent / line.available : line?.spent ? 2 : 0;
  const movedOut = line ? line.actual - line.spent : 0;

  return (
    <>
      <Link
        href={data.href("/pockets")}
        className="-ms-1 flex w-fit items-center gap-0.5 rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <RiArrowLeftSLine className="size-4 rtl:-scale-x-100" aria-hidden />
        Pockets
      </Link>
      <PageHeader
        title={pocket.name}
        description={
          <span className="flex items-center gap-2">
            <CategoryIcon name={pocket.name} emoji={pocket.emoji} color={pocket.color} group={pocket.group} size="sm" />
            <span className={cx("text-title-2-medium tabular-nums", ledger.balance < 0 ? "text-text-negative" : "text-text-primary")}>
              {fmt(ledger.balance)}
            </span>
            <span className="text-body-2-regular text-text-tertiary">{ledger.balance < 0 ? "over" : "left"}</span>
          </span>
        }
        actions={
          canWrite ? (
            <AdjustBalanceButton potId={pocket.id} potName={pocket.name} balance={ledger.balance} money={data.money} today={data.today} pocket />
          ) : undefined
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
          {line ? (
            <div className="flex flex-col gap-1.5">
              <Meter aria-label={`${pocket.name} spent this period`} value={Math.min(usage, 1) * 100} tone={usageTone(usage)} size="sm" />
              <span className="text-caption-1-medium text-text-tertiary tabular-nums">
                {fmt(line.spent)} spent of {fmt(line.available)}
                {movedOut ? ` · ${signed(-movedOut)} moved${line.toSavings ? ` (${fmt(line.toSavings)} to savings)` : ""}` : ""}
                {carried ? ` · ${signed(carried)} carried and adjusted` : ""}
              </span>
            </div>
          ) : null}
        </div>
      </Card>

      <Card
        title="Ledger"
        description={`Every movement of this pocket since ${monthLabel(since)}, newest first, with the balance after each one. What you keep at month end carries into the next period; Close the month on the Budget page sends it to savings.`}
      >
        {groups.length === 0 ? (
          <p className="text-body-2-regular text-text-secondary">Nothing here yet. Give it a budget on the Budget page.</p>
        ) : (
          <div className="flex flex-col gap-5">
            {groups.map((g) => (
              <section key={g.month} className="flex flex-col gap-1">
                <header className="flex items-baseline justify-between gap-3 px-1">
                  <h3 className="text-body-semibold text-text-primary">{monthLabel(g.month)}</h3>
                  <span className="text-body-2-regular text-text-tertiary tabular-nums">
                    {g.month === period ? "Now" : "Ended at"} {fmt(g.end)}
                  </span>
                </header>
                <ul className="flex flex-col divide-y divide-separator-border rounded-2xl border border-border-button-default">
                  {g.entries.map((e) => (
                    <li key={`${e.kind}-${e.id}`} className="flex items-center gap-3 px-3 py-2.5">
                      <span className="w-12 shrink-0 text-body-2-regular text-text-tertiary tabular-nums">{day(e.date)}</span>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-body-medium text-text-primary">{e.description || label(e)}</span>
                        {e.description ? <span className="truncate text-caption-1-medium text-text-tertiary">{label(e)}</span> : null}
                      </div>
                      <div className="flex shrink-0 flex-col items-end">
                        <span className={cx("text-body-medium tabular-nums", e.amount < 0 ? "text-text-negative" : "text-text-primary")}>
                          {signed(e.amount)}
                        </span>
                        <span className="text-caption-1-regular text-text-tertiary tabular-nums">{fmt(e.balance)}</span>
                      </div>
                      {e.kind === "adjustment" && canWrite ? <DeleteAdjustmentButton id={e.id} label={e.description} /> : null}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
