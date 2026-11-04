import { requireBookPage } from "@/auth";
import Link from "next/link";
import { RiCalendarCheckLine, RiCheckDoubleLine } from "@remixicon/react";
import { BudgetBar } from "@/components/app/budget-bar";
import { Card, EmptyState } from "@/components/app/card";
import { GroupDonut, TrendChart } from "@/components/app/charts";
import { DashboardStats, type DashboardStat } from "@/components/app/dashboard-stats";
import { MonthNav, monthLabel, shortDate } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { QuickAdd } from "@/components/app/quick-add";
import { Chip } from "@/components/base/badges/chip";
import { Meter } from "@/components/base/meter/meter";
import { formOptions, loadAppData, monthParam } from "@/lib/data/app-data";
import { budgetMonth } from "@/lib/finance/budget";
import { addMonths, monthsEnding } from "@/lib/finance/dates";
import { goalProgress } from "@/lib/finance/goals";
import { installmentStatus } from "@/lib/finance/installments";
import { accountBalances } from "@/lib/finance/ledger";
import { formatMoney, formatPercent } from "@/lib/finance/money";
import { periodOf } from "@/lib/finance/period";

function delta(current: number, previous: number, higherIsGood: boolean): Pick<DashboardStat, "delta" | "deltaColor"> {
  if (previous === 0) return { delta: "—", deltaColor: "neutral" };
  const change = (current - previous) / previous;
  const good = higherIsGood ? change >= 0 : change <= 0;
  return {
    delta: `${change >= 0 ? "+" : ""}${Math.round(change * 100)}%`,
    deltaColor: Math.abs(change) < 0.005 ? "neutral" : good ? "lime" : "rose",
  };
}

export default async function DashboardPage({ params: route, searchParams }: PageProps<"/b/[bookId]">) {
  const params = await searchParams;
  const data = await loadAppData(await requireBookPage((await route).bookId));
  const month = monthParam(params.m, data.current.period);
  const { money, categories, transactions: txns, budgets, cutoffDay: cutoff } = data;
  const fmt = (n: number) => formatMoney(n, money);

  const bm = budgetMonth({ month, budgets, categories, txns, cutoff });
  const prev = budgetMonth({ month: addMonths(month, -1), budgets, categories, txns, cutoff });
  const isCurrentMonth = month === data.current.period;

  const stats: DashboardStat[] = [
    {
      key: "income",
      label: "Income",
      value: fmt(bm.actualIncome),
      ...delta(bm.actualIncome, prev.actualIncome, true),
      caption: bm.plannedIncome ? `Planned ${fmt(bm.plannedIncome)}` : "From last month",
      tone: "emerald",
    },
    {
      key: "spent",
      label: "Spent",
      value: fmt(bm.spent),
      ...delta(bm.spent, prev.spent, false),
      caption: `Budget ${fmt(bm.budgetedExpenses)}`,
      hint: "Needs + Wants. Savings are tracked separately.",
      tone: "blue",
    },
    {
      key: "saved",
      label: "Saved",
      value: fmt(bm.saved),
      ...delta(bm.saved, prev.saved, true),
      caption: `Planned ${fmt(bm.groups.Savings.budget)}`,
      tone: "purple",
    },
    {
      key: "unallocated",
      label: "Left to assign",
      value: fmt(bm.nonAllocated),
      delta: formatPercent(bm.allocationRatio, money.locale),
      deltaColor: bm.nonAllocated < 0 ? "rose" : "neutral",
      caption: "Allocated of planned income",
      hint: "Planned income minus every budget (Needs, Wants, Savings) for the month.",
      tone: "orange",
    },
  ];

  const trendMonths = monthsEnding(month, 6);
  const trend = trendMonths.map((m) => {
    const b = budgetMonth({ month: m, budgets, categories, txns, cutoff });
    return { label: monthLabel(m, "en-GB", "short").split(" ")[0], spent: b.spent, budget: b.budgetedExpenses, income: b.actualIncome };
  });

  const expenseLines = bm.lines
    .filter((l) => l.category.group !== "Savings" && (l.budget > 0 || l.actual > 0))
    .sort((a, b) => b.usage - a.usage);
  const balances = accountBalances(data.accounts, txns);
  const goals = data.goals.filter((g) => !g.archived).map((g) => goalProgress(g, categories, txns, data.today, cutoff));
  const installments = data.installments
    .map((i) => installmentStatus(i, txns, data.today, cutoff))
    .filter((s) => !s.isComplete);
  const unverified = txns.filter((t) => !t.verified && periodOf(t.date, cutoff) <= month).length;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <RiCalendarCheckLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
            {isCurrentMonth
              ? `${data.current.daysLeft === 0 ? "Last day of this period" : `${data.current.daysLeft} days left in this period`} · cut-off ${shortDate(data.current.end)}`
              : `Period ${monthLabel(month)}`}
          </span>
        }
        actions={
          <>
            <MonthNav month={month} path={data.href()} params={params} cutoff={cutoff} />
            {/* Phones add from the tab bar's "+" */}
            <div className="hidden lg:block">
              <QuickAdd options={formOptions(data)} />
            </div>
          </>
        }
      />

      <DashboardStats stats={stats} />

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Spending vs budget" description="Needs + Wants, last 6 months" className="xl:col-span-2">
          <TrendChart data={trend} money={money} />
        </Card>
        <Card title="Where it went" description={monthLabel(month)}>
          <GroupDonut
            money={money}
            data={[
              { group: "Needs", value: bm.groups.Needs.actual },
              { group: "Wants", value: bm.groups.Wants.actual },
              { group: "Savings", value: bm.groups.Savings.actual },
            ]}
          />
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title="Budget usage" description={`${monthLabel(month)} · most used first`} href={data.href(`/budget?m=${month}`)} className="xl:col-span-2">
          {expenseLines.length === 0 ? (
            <EmptyState>
              No budgets for this month yet. <Link className="text-accent-600 underline" href={data.href(`/budget?m=${month}`)}>Set them up</Link>.
            </EmptyState>
          ) : (
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {expenseLines.map((l) => (
                <BudgetBar key={l.category.id} name={l.category.name} category={l.category} actual={l.actual} budget={l.budget} money={money} />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {unverified > 0 ? (
            <Link
              href={data.href("/reconcile")}
              className="flex items-center gap-3 rounded-3xl border border-border-button-default bg-background-primary-default p-4 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-2lg bg-linear-to-b from-yellow-400 to-yellow-500">
                <RiCheckDoubleLine className="size-5 text-white" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-body-semibold text-text-primary">{unverified} to reconcile</span>
                <span className="text-body-2-regular text-text-tertiary">Tick them off against your bank statements</span>
              </span>
            </Link>
          ) : null}

          <Card title="Accounts" href={data.href("/accounts")}>
            <ul className="flex flex-col gap-2.5">
              {data.accounts
                .filter((a) => !a.archived)
                .map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3">
                    <span className="text-body-medium text-text-secondary">{a.name}</span>
                    <span className="text-body-medium text-text-primary tabular-nums">{fmt(balances.get(a.id) ?? 0)}</span>
                  </li>
                ))}
            </ul>
          </Card>

          <Card title="Installments" href={data.href("/installments")}>
            {installments.length === 0 ? (
              <EmptyState>Nothing outstanding.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-3">
                {installments.map((s) => (
                  <li key={s.installment.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate text-body-medium text-text-primary">{s.installment.name}</span>
                      <span className="text-body-2-regular text-text-tertiary">
                        {s.currentIndex}/{s.installment.tenor_months} · paid off {monthLabel(s.payoffMonth, "en-GB", "short")}
                      </span>
                    </span>
                    {isCurrentMonth && s.isDue ? (
                      <Chip color="yellow">Due {fmt(s.installment.monthly_amount)}</Chip>
                    ) : (
                      <Chip color="neutral">{fmt(s.remaining)} left</Chip>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title="Goals" href={data.href("/goals")}>
        {goals.length === 0 ? (
          <EmptyState>No goals yet.</EmptyState>
        ) : (
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
            {goals.map((g) => (
              <div key={g.goal.id} className="flex flex-col gap-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-body-medium text-text-primary">{g.goal.name}</span>
                  <span className="text-body-2-regular text-text-tertiary tabular-nums">{Math.round(g.ratio * 100)}%</span>
                </div>
                <Meter aria-label={`${g.goal.name} progress`} value={g.ratio * 100} tone={g.ratio >= 1 ? "success" : "accent"} size="sm" />
                <span className="text-caption-1-medium text-text-tertiary tabular-nums">
                  {fmt(g.saved)} of {fmt(g.goal.target_amount)}
                  {g.requiredMonthly ? ` · ${fmt(g.requiredMonthly)}/mo to go` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
