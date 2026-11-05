import type { Metadata } from "next";
import Link from "next/link";
import { RiArrowRightSLine } from "@remixicon/react";
import { requireBookPage } from "@/auth";
import { Card, EmptyState } from "@/components/app/card";
import { CategoryIcon } from "@/components/app/category-icon";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { Meter } from "@/components/base/meter/meter";
import { loadAdjustments, loadAppData } from "@/lib/data/app-data";
import { monthsEnding } from "@/lib/finance/dates";
import { formatMoney } from "@/lib/finance/money";
import { planGoalMerge, potLedger, potTarget } from "@/lib/finance/savings";
import { can } from "@/lib/auth/roles";
import { MergeGoals, type GoalMergeRow } from "@/components/app/merge-goals";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Savings" };

export default async function SavingsPage({ params }: PageProps<"/b/[bookId]/savings">) {
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const adjustments = await loadAdjustments(data);
  const fmt = (n: number) => formatMoney(n, data.money);
  const period = data.current.period;
  const recent = monthsEnding(period, 6);

  const pots = data.categories
    .filter((c) => c.group === "Savings")
    .map((c) => {
      const ledger = potLedger(c, data.categories, data.transactions, adjustments, data.cutoffDay);
      const thisMonth = ledger.months.find((m) => m.month === period);
      // Month-end balance for the last six periods, carrying the last known balance forward.
      let carry = c.starting_balance;
      const trend = recent.map((m) => {
        const found = ledger.months.filter((x) => x.month <= m).at(-1);
        carry = found ? found.end : carry;
        return { month: m, end: carry };
      });
      return {
        category: c,
        ledger,
        change: thisMonth ? thisMonth.in - thisMonth.out : 0,
        trend,
        target: potTarget(c, ledger.balance, data.today, data.cutoffDay),
      };
    })
    .filter((p) => !p.category.archived || p.ledger.balance !== 0)
    .sort((a, b) => b.ledger.balance - a.ledger.balance);
  const total = pots.reduce((s, p) => s + p.ledger.balance, 0);
  const change = pots.reduce((s, p) => s + p.change, 0);

  // Books from before goals moved onto pots: offer the one-time merge to admins.
  const month = (iso: string) => new Intl.DateTimeFormat("en-GB", { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const mergeRows: GoalMergeRow[] =
    data.settings.goals_merged !== "true" && data.goals.length > 0 && can(data.membership.role, "setup:write")
      ? planGoalMerge(data.goals, data.categories, () => "new").map((m) => ({
          goalId: m.goal.id,
          goal: m.goal.name,
          pot: m.pot.name,
          isNew: m.isNew,
          target: fmt(m.goal.target_amount),
          by: m.goal.target_date ? `by ${month(m.goal.target_date)}` : "",
          startingBalance: m.isNew ? (m.goal.starting_amount ? fmt(m.goal.starting_amount) : "") : m.patch.starting_balance ? fmt(m.patch.starting_balance) : "",
          notes: m.notes,
        }))
      : [];

  return (
    <>
      <PageHeader
        title="Savings"
        description="Each Savings category is a pot: its starting balance, plus everything saved or moved in, minus what left, plus any adjustments."
      />
      {mergeRows.length ? <MergeGoals rows={mergeRows} /> : null}
      <Card>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-body-2-regular text-text-tertiary">Total saved</dt>
            <dd className="text-title-2-medium text-text-primary tabular-nums">{fmt(total)}</dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-body-2-regular text-text-tertiary">This period ({monthLabel(period)})</dt>
            <dd className={cx("text-title-3-semibold tabular-nums", change < 0 ? "text-text-error-primary" : "text-text-primary")}>
              {change > 0 ? "+" : change < 0 ? "−" : ""}
              {fmt(Math.abs(change))}
            </dd>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-body-2-regular text-text-tertiary">Pots</dt>
            <dd className="text-title-3-semibold text-text-primary tabular-nums">{pots.length}</dd>
          </div>
        </dl>
      </Card>

      {pots.length === 0 ? (
        <Card>
          <EmptyState>No savings pots yet. Add a category in the Savings group (Settings → Categories).</EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {pots.map((p) => {
            const max = Math.max(1, ...p.trend.map((t) => t.end));
            return (
              <li key={p.category.id}>
                <Link
                  href={data.href(`/savings/${p.category.id}`)}
                  className={cx(
                    "flex h-full flex-col gap-3 rounded-3xl border border-separator-border bg-background-primary-default p-3 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring sm:p-4",
                    p.category.archived && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon name={p.category.name} emoji={p.category.emoji} color={p.category.color} group={p.category.group} />
                    <span className="min-w-0 flex-1 truncate text-headline-semibold text-text-primary">{p.category.name}</span>
                    <RiArrowRightSLine className="size-5 shrink-0 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden />
                  </div>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-title-2-medium text-text-primary tabular-nums">{fmt(p.ledger.balance)}</span>
                      <span className="text-body-2-regular text-text-tertiary tabular-nums">
                        {p.change === 0 ? "No change this period" : `${p.change > 0 ? "+" : "−"}${fmt(Math.abs(p.change))} this period`}
                      </span>
                    </div>
                    <div className="flex h-10 w-28 items-end gap-1" aria-label="Balance at the end of the last 6 periods">
                      {p.trend.map((t) => (
                        <div
                          key={t.month}
                          title={`${monthLabel(t.month)}: ${fmt(t.end)}`}
                          className={cx("flex-1 rounded-t-sm", t.month === period ? "bg-chart-5" : "bg-background-tertiary-default")}
                          style={{ height: `${Math.max(3, (Math.max(t.end, 0) / max) * 40)}px` }}
                        />
                      ))}
                    </div>
                  </div>
                  {p.target ? (
                    <div className="flex flex-col gap-1.5">
                      <Meter aria-label={`${p.category.name} target progress`} value={p.target.ratio * 100} tone={p.target.ratio >= 1 ? "success" : "accent"} size="sm" />
                      <span className="text-caption-1-medium text-text-tertiary tabular-nums">
                        {p.target.ratio >= 1
                          ? `Target ${fmt(p.target.target)} reached`
                          : `${fmt(p.target.remaining)} to go of ${fmt(p.target.target)}${p.target.requiredMonthly ? ` · ${fmt(p.target.requiredMonthly)}/mo` : ""}`}
                      </span>
                    </div>
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
