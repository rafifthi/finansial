import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RiArrowLeftSLine } from "@remixicon/react";
import { requireBookPage } from "@/auth";
import { Card } from "@/components/app/card";
import { CategoryIcon } from "@/components/app/category-icon";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { AdjustBalanceButton, DeleteAdjustmentButton } from "@/components/app/savings-adjust";
import { Chip } from "@/components/base/badges/chip";
import { Meter } from "@/components/base/meter/meter";
import { can } from "@/lib/auth/roles";
import { loadAdjustments, loadAppData } from "@/lib/data/app-data";
import { formatMoney } from "@/lib/finance/money";
import { periodOf } from "@/lib/finance/period";
import { potLedger, potTarget, type PotEntry } from "@/lib/finance/savings";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Savings" };

const KIND: Record<PotEntry["kind"], { label: (e: PotEntry) => string; color: "neutral" | "lime" | "blue" | "yellow" | "rose" }> = {
  start: { label: () => "Starting balance", color: "neutral" },
  saved: { label: () => "Saved", color: "lime" },
  "moved-in": { label: (e) => `From ${e.counterpart || "?"}`, color: "blue" },
  "moved-out": { label: (e) => `To ${e.counterpart || "?"}`, color: "rose" },
  adjustment: { label: () => "Adjustment", color: "yellow" },
};

export default async function PotPage({ params }: PageProps<"/b/[bookId]/savings/[categoryId]">) {
  const { bookId, categoryId } = await params;
  const data = await loadAppData(await requireBookPage(bookId));
  const pot = data.categoryById.get(categoryId);
  if (!pot || pot.group !== "Savings") notFound();
  const adjustments = await loadAdjustments(data);
  const ledger = potLedger(pot, data.categories, data.transactions, adjustments, data.cutoffDay);
  const canWrite = can(data.membership.role, "data:write");
  const target = potTarget(pot, ledger.balance, data.today, data.cutoffDay);
  const canSetup = can(data.membership.role, "setup:write");
  const fmt = (n: number) => formatMoney(n, data.money);
  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
  const day = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));

  // Newest first, grouped by budget period; the starting balance closes the list.
  const moves = ledger.entries.filter((e) => e.kind !== "start").reverse();
  const groups: { month: string; end: number; entries: PotEntry[] }[] = [];
  for (const e of moves) {
    const month = periodOf(e.date, data.cutoffDay);
    const group = groups.at(-1);
    if (group?.month === month) group.entries.push(e);
    else groups.push({ month, end: e.balance, entries: [e] });
  }

  const tiles = [
    { label: "Starting balance", value: fmt(ledger.totals.start) },
    { label: "Moved in", value: fmt(ledger.totals.in) },
    { label: "Taken out", value: fmt(ledger.totals.out) },
    { label: "Adjustments", value: signed(ledger.totals.adjusted) },
  ];

  return (
    <>
      <Link
        href={data.href("/savings")}
        className="-ms-1 flex w-fit items-center gap-0.5 rounded-md text-body-2-medium text-text-secondary outline-none hover:text-text-primary focus-visible:ring-2 focus-visible:ring-border-focus-ring"
      >
        <RiArrowLeftSLine className="size-4 rtl:-scale-x-100" aria-hidden />
        Savings
      </Link>
      <PageHeader
        title={pot.name}
        description={
          <span className="flex items-center gap-2">
            <CategoryIcon name={pot.name} emoji={pot.emoji} color={pot.color} group={pot.group} size="sm" />
            <span className="text-title-2-medium text-text-primary tabular-nums">{fmt(ledger.balance)}</span>
          </span>
        }
        actions={
          canWrite ? <AdjustBalanceButton potId={pot.id} potName={pot.name} balance={ledger.balance} money={data.money} today={data.today} /> : undefined
        }
      />
      <Card>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {tiles.map((t) => (
            <div key={t.label} className="flex flex-col gap-0.5">
              <dt className="text-body-2-regular text-text-tertiary">{t.label}</dt>
              <dd className="text-title-3-semibold text-text-primary tabular-nums">{t.value}</dd>
            </div>
          ))}
        </dl>
      </Card>

      {target ? (
        <Card
          title="Target"
          description={target.date ? `By ${monthLabel(periodOf(target.date, data.cutoffDay))}` : "No deadline"}
          action={
            target.ratio >= 1 ? (
              <Chip color="lime">Reached</Chip>
            ) : target.requiredMonthly !== null ? (
              <Chip color={target.monthsLeft === 0 ? "rose" : "neutral"}>
                {fmt(target.requiredMonthly)}/mo · {target.monthsLeft} mo left
              </Chip>
            ) : null
          }
        >
          <div className="flex items-end justify-between gap-3">
            <span className="text-body-regular text-text-secondary tabular-nums">
              {fmt(ledger.balance)} of {fmt(target.target)}
            </span>
            <span className="text-body-2-regular text-text-tertiary tabular-nums">
              {target.ratio >= 1 ? "Done" : `${fmt(target.remaining)} to go`}
            </span>
          </div>
          <Meter aria-label={`${pot.name} target progress`} value={target.ratio * 100} tone={target.ratio >= 1 ? "success" : "accent"} />
        </Card>
      ) : canSetup ? (
        <p className="text-body-2-regular text-text-tertiary">
          No target yet.{" "}
          <Link href={data.href("/settings?tab=categories&group=Savings#categories")} className="text-button-ghost-foreground hover:underline">
            Set one in Settings → Categories
          </Link>
          .
        </p>
      ) : null}

      <Card title="Ledger" description="Every movement of this pot, newest first, with the balance after each one.">
        <div className="flex flex-col gap-5">
          {groups.map((g) => (
            <section key={g.month} className="flex flex-col gap-1">
              <header className="flex items-baseline justify-between gap-3 px-1">
                <h3 className="text-body-semibold text-text-primary">{monthLabel(g.month)}</h3>
                <span className="text-body-2-regular text-text-tertiary tabular-nums">Ended at {fmt(g.end)}</span>
              </header>
              <ul className="flex flex-col divide-y divide-separator-border rounded-2xl border border-border-button-default">
                {g.entries.map((e) => (
                  <LedgerRow key={`${e.kind}-${e.id}`} entry={e} amount={signed(e.amount)} balance={fmt(e.balance)} date={day(e.date)} canWrite={canWrite} />
                ))}
              </ul>
            </section>
          ))}
          <ul className="flex flex-col rounded-2xl border border-dashed border-border-button-default">
            <LedgerRow entry={ledger.entries[0]} amount={fmt(ledger.totals.start)} balance={fmt(ledger.totals.start)} date="" canWrite={false} />
          </ul>
          {pot.starting_balance === 0 && moves.length === 0 ? (
            <p className="text-body-2-regular text-text-tertiary">
              Nothing here yet. Set what it already holds with Adjust balance, or as its starting balance in Settings → Categories.
            </p>
          ) : null}
        </div>
      </Card>
    </>
  );
}

function LedgerRow({ entry, amount, balance, date, canWrite }: { entry: PotEntry; amount: string; balance: string; date: string; canWrite: boolean }) {
  const kind = KIND[entry.kind];
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      <span className="w-12 shrink-0 text-body-2-regular text-text-tertiary tabular-nums">{date}</span>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
        <span className="truncate text-body-medium text-text-primary">{entry.description || kind.label(entry)}</span>
        <Chip color={kind.color} variant="caption" className="self-start sm:self-auto">
          {kind.label(entry)}
        </Chip>
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className={cx("text-body-medium tabular-nums", entry.amount < 0 ? "text-text-error-primary" : "text-text-primary")}>{amount}</span>
        <span className="text-caption-1-regular text-text-tertiary tabular-nums">{balance}</span>
      </div>
      {entry.kind === "adjustment" && canWrite ? <DeleteAdjustmentButton id={entry.id} label={entry.description} /> : null}
    </li>
  );
}
