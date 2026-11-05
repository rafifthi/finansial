import { requireBookPage } from "@/auth";
import Link from "next/link";
import { RiCalendarCheckLine, RiCheckDoubleLine } from "@remixicon/react";
import { BudgetBar } from "@/components/app/budget-bar";
import { Card, EmptyState } from "@/components/app/card";
import { CategoryIcon } from "@/components/app/category-icon";
import { GroupDonut, TrendChart } from "@/components/app/charts";
import { DashboardStats, type DashboardStat } from "@/components/app/dashboard-stats";
import { MonthNav, monthLabel, shortDate } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { QuickAdd } from "@/components/app/quick-add";
import { Chip } from "@/components/base/badges/chip";
import { Meter } from "@/components/base/meter/meter";
import { formOptions, loadAdjustments, loadAppData, monthParam } from "@/lib/data/app-data";
import { budgetMonth } from "@/lib/finance/budget";
import { addMonths, monthsEnding } from "@/lib/finance/dates";
import { potTarget } from "@/lib/finance/savings";
import { installmentStatus } from "@/lib/finance/installments";
import { savingsBalances } from "@/lib/finance/ledger";
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
  const adjustments = await loadAdjustments(data);
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
    // Unspent = income not spent on Needs + Wants: what went to savings, plus the rest (unallocated or not yet moved).
    const saved = Math.max(b.saved, 0);
    return {
      label: monthLabel(m, "en-GB", "short").split(" ")[0],
      spent: b.spent,
      saved,
      rest: Math.max(b.actualIncome - b.spent - saved, 0),
      income: b.actualIncome,
    };
  });

  const expenseLines = bm.lines
    .filter((l) => l.category.group !== "Savings" && (l.budget > 0 || l.actual > 0))
    .sort((a, b) => b.usage - a.usage);
  const balances = savingsBalances(categories, txns, adjustments);
  const pots = categories.filter((c) => c.group === "Savings" && (!c.archived || (balances.get(c.id) ?? 0) !== 0));
  const totalSaved = pots.reduce((s, c) => s + (balances.get(c.id) ?? 0), 0);
  const targets = pots.flatMap((c) => {
    const t = potTarget(c, balances.get(c.id) ?? 0, data.today, cutoff);
    return t && !c.archived ? [{ pot: c, balance: balances.get(c.id) ?? 0, ...t }] : [];
  });
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
        <Card title="Spent vs unspent" description="Needs + Wants spending against what was left of income, last 6 months" className="xl:col-span-2">
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
              No budgets for this month yet. <Link className="text-button-ghost-foreground underline" href={data.href(`/budget?m=${month}`)}>Set them up</Link>.
            </EmptyState>
          ) : (
            <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
              {expenseLines.map((l) => (
                <BudgetBar key={l.category.id} name={l.category.name} category={l.category} actual={l.actual} spent={l.spent} toSavings={l.toSavings} budget={l.budget} money={money} />
              ))}
            </div>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          {unverified > 0 ? (
            <Link
              href={data.href("/reconcile")}
              className="flex items-center gap-3 rounded-3xl border border-separator-border bg-background-primary-default p-4 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              <span className="flex size-10 items-center justify-center rounded-2lg bg-background-secondary-default">
                <RiCheckDoubleLine className="size-5 text-foreground-icon-primary" aria-hidden />
              </span>
              <span className="flex flex-col">
                <span className="text-body-semibold text-text-primary">{unverified} to reconcile</span>
                <span className="text-body-2-regular text-text-tertiary">Tick them off against your bank statements</span>
              </span>
            </Link>
          ) : null}

          <Card title="Savings" description={pots.length ? `${fmt(totalSaved)} in total` : undefined} href={data.href("/savings")}>
            {pots.length === 0 ? (
              <EmptyState>No savings categories yet.</EmptyState>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {pots.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={data.href(`/savings/${c.id}`)}
                      className="-mx-1.5 flex items-center justify-between gap-3 rounded-lg px-1.5 py-1 outline-none hover:bg-background-secondary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring"
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <CategoryIcon name={c.name} emoji={c.emoji} color={c.color} group={c.group} size="sm" />
                        <span className="truncate text-body-medium text-text-secondary">{c.name}</span>
                      </span>
                      <span className="text-body-medium text-text-primary tabular-nums">{fmt(balances.get(c.id) ?? 0)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
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

      <Card title="Savings targets" href={data.href("/savings")}>
        {targets.length === 0 ? (
          <EmptyState>No targets yet. Give a savings pot a target in Settings → Categories.</EmptyState>
        ) : (
          <div className="grid gap-x-8 gap-y-5 md:grid-cols-2 xl:grid-cols-4">
            {targets.map((t) => (
              <Link key={t.pot.id} href={data.href(`/savings/${t.pot.id}`)} className="flex flex-col gap-1.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-body-medium text-text-primary">{t.pot.name}</span>
                  <span className="text-body-2-regular text-text-tertiary tabular-nums">{Math.round(t.ratio * 100)}%</span>
                </div>
                <Meter aria-label={`${t.pot.name} target progress`} value={t.ratio * 100} tone={t.ratio >= 1 ? "success" : "accent"} size="sm" />
                <span className="text-caption-1-medium text-text-tertiary tabular-nums">
                  {fmt(t.balance)} of {fmt(t.target)}
                  {t.requiredMonthly ? ` · ${fmt(t.requiredMonthly)}/mo to go` : ""}
                </span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
