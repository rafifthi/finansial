import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { RiArrowRightSLine } from "@remixicon/react";
import { requireBookPage } from "@/auth";
import { Card, EmptyState } from "@/components/app/card";
import { usageTone } from "@/components/app/budget-bar";
import { CategoryIcon } from "@/components/app/category-icon";
import { monthLabel } from "@/components/app/month-nav";
import { PageHeader } from "@/components/app/page-header";
import { Meter } from "@/components/base/meter/meter";
import { loadAdjustments, loadAppData, loadPockets } from "@/lib/data/app-data";
import { budgetMonth, type BudgetLine } from "@/lib/finance/budget";
import { monthsEnding } from "@/lib/finance/dates";
import { formatMoney } from "@/lib/finance/money";
import { planGoalMerge, potLedger, potTarget } from "@/lib/finance/savings";
import { can } from "@/lib/auth/roles";
import { MergeGoals, type GoalMergeRow } from "@/components/app/merge-goals";
import { PocketsFilter, type PocketsShow } from "@/components/app/pockets-filter";
import type { Category } from "@/lib/sheets/schema";
import { cx } from "@/utils/cx";

export const metadata: Metadata = { title: "Pockets" };

/**
 * Every Needs, Wants and Savings category is a pocket with its own balance.
 * Needs and Wants get their budget each period and keep whatever isn't spent
 * or sent on at month end; Savings grow when you save and can have a goal.
 */
export default async function PocketsPage({ params, searchParams }: PageProps<"/b/[bookId]/pockets">) {
  const shown = (await searchParams).show;
  const show: PocketsShow = shown === "spending" || shown === "savings" ? shown : "all";
  const data = await loadAppData(await requireBookPage((await params).bookId));
  const adjustments = await loadAdjustments(data);
  const fmt = (n: number) => formatMoney(n, data.money);
  const period = data.current.period;
  const recent = monthsEnding(period, 6);

  // Savings: the pot balance, its change this period, a six-period trend and the goal.
  const savings = data.categories
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
        balance: ledger.balance,
        change: thisMonth ? thisMonth.in - thisMonth.out : 0,
        trend,
        target: potTarget(c, ledger.balance, data.today, data.cutoffDay),
      };
    })
    .filter((p) => !p.category.archived || p.balance !== 0)
    .sort((a, b) => b.balance - a.balance);

  // Needs and Wants: what this period's line can still use, carried-over money included.
  const bm = budgetMonth({
    month: period,
    budgets: data.budgets,
    categories: data.categories,
    txns: data.transactions,
    cutoff: data.cutoffDay,
    pockets: loadPockets(data, period, adjustments),
  });
  const spending = (group: "Needs" | "Wants") => bm.lines.filter((l) => l.category.group === group && (!l.category.archived || l.remaining !== 0));
  const needs = spending("Needs");
  const wants = spending("Wants");

  const totalSaved = savings.reduce((s, p) => s + p.balance, 0);
  const savedChange = savings.reduce((s, p) => s + p.change, 0);
  const leftToSpend = [...needs, ...wants].reduce((s, l) => s + l.remaining, 0);
  const carried = [...needs, ...wants].reduce((s, l) => s + l.carried, 0);

  // Books from before goals moved onto pots: offer the one-time merge to admins.
  const month = (iso: string) =>
    new Intl.DateTimeFormat("en-GB", {
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${iso}T00:00:00Z`));
  const mergeRows: GoalMergeRow[] =
    data.settings.goals_merged !== "true" && data.goals.length > 0 && can(data.membership.role, "setup:write")
      ? planGoalMerge(data.goals, data.categories, () => "new").map((m) => ({
          goalId: m.goal.id,
          goal: m.goal.name,
          pot: m.pot.name,
          isNew: m.isNew,
          target: fmt(m.goal.target_amount),
          by: m.goal.target_date ? `by ${month(m.goal.target_date)}` : "",
          startingBalance: m.isNew
            ? m.goal.starting_amount
              ? fmt(m.goal.starting_amount)
              : ""
            : m.patch.starting_balance
              ? fmt(m.patch.starting_balance)
              : "",
          notes: m.notes,
        }))
      : [];

  const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${fmt(Math.abs(n))}`;
  const settingsHref = (group: string) => data.href(`/settings?tab=categories&group=${group}#categories`);

  return (
    <>
      <PageHeader
        title="Pockets"
        description="Every category keeps its own balance. Needs and Wants get their budget each month and keep what you don't spend until you move it; Savings grow when you save and can have a goal."
      />
      {mergeRows.length ? <MergeGoals rows={mergeRows} /> : null}
      <Card>
        <dl className="grid gap-4 sm:grid-cols-3">
          <div className="flex flex-col gap-0.5">
            <dt className="text-body-2-regular text-text-tertiary">In savings</dt>
            <dd className="text-title-2-medium text-text-primary tabular-nums">{fmt(totalSaved)}</dd>
            <span className="text-body-2-regular text-text-tertiary tabular-nums">
              {signed(savedChange)} in {monthLabel(period)}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-body-2-regular text-text-tertiary">Left in Needs and Wants</dt>
            <dd className={cx("text-title-2-medium tabular-nums", leftToSpend < 0 ? "text-text-negative" : "text-text-primary")}>
              {fmt(leftToSpend)}
            </dd>
            <span className="text-body-2-regular text-text-tertiary tabular-nums">
              {carried ? `${signed(carried)} carried from earlier months` : "Nothing carried from earlier months"}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <dt className="text-body-2-regular text-text-tertiary">Pockets</dt>
            <dd className="text-title-2-medium text-text-primary tabular-nums">{savings.length + needs.length + wants.length}</dd>
          </div>
        </dl>
      </Card>

      <PocketsFilter
        initial={show}
        counts={{
          all: savings.length + needs.length + wants.length,
          spending: needs.length + wants.length,
          savings: savings.length,
        }}
        savings={
          <PocketSection
            title="Savings"
            hint="Grow when you save or move money in. Set a goal in Settings → Categories."
            total={fmt(totalSaved)}
            empty={savings.length === 0}
            emptyHref={settingsHref("Savings")}
          >
            {savings.map((p) => {
              const max = Math.max(1, ...p.trend.map((t) => t.end));
              return (
                <PocketLink key={p.category.id} href={data.href(`/pockets/${p.category.id}`)} category={p.category}>
                  <div className="flex items-end justify-between gap-3">
                    <div className="flex flex-col">
                      <span className="text-title-2-medium text-text-primary tabular-nums">{fmt(p.balance)}</span>
                      <span className="text-body-2-regular text-text-tertiary tabular-nums">
                        {p.change === 0 ? "No change this period" : `${signed(p.change)} this period`}
                      </span>
                    </div>
                    <div className="flex h-10 w-28 items-end gap-1" aria-label="Balance at the end of the last 6 periods">
                      {p.trend.map((t) => (
                        <div
                          key={t.month}
                          title={`${monthLabel(t.month)}: ${fmt(t.end)}`}
                          className={cx("flex-1 rounded-t-sm", t.month === period ? "bg-chart-5" : "bg-background-tertiary-default")}
                          style={{
                            height: `${Math.max(3, (Math.max(t.end, 0) / max) * 40)}px`,
                          }}
                        />
                      ))}
                    </div>
                  </div>
                  {p.target ? (
                    <div className="flex flex-col gap-1.5">
                      <Meter
                        aria-label={`${p.category.name} goal progress`}
                        value={p.target.ratio * 100}
                        tone={p.target.ratio >= 1 ? "success" : "accent"}
                        size="sm"
                      />
                      <span className="text-caption-1-medium text-text-tertiary tabular-nums">
                        {p.target.ratio >= 1
                          ? `Goal ${fmt(p.target.target)} reached`
                          : `${fmt(p.target.remaining)} to go of ${fmt(p.target.target)}${p.target.requiredMonthly ? ` · ${fmt(p.target.requiredMonthly)}/mo` : ""}`}
                      </span>
                    </div>
                  ) : null}
                </PocketLink>
              );
            })}
          </PocketSection>
        }
        spending={(
          [
            ["Needs", "Bills and essentials", needs],
            ["Wants", "Everything else", wants],
          ] as const
        ).map(([group, hint, lines]) => (
          <PocketSection
            key={group}
            title={group}
            hint={`${hint}. Filled by each month's budget; what's left stays until you send it to savings.`}
            total={`${fmt(lines.reduce((s, l) => s + l.remaining, 0))} left`}
            empty={lines.length === 0}
            emptyHref={settingsHref(group)}
          >
            {lines.map((l) => (
              <SpendingCard key={l.category.id} line={l} href={data.href(`/pockets/${l.category.id}`)} fmt={fmt} signed={signed} />
            ))}
          </PocketSection>
        ))}
      />
    </>
  );
}

function PocketSection({
  title,
  hint,
  total,
  empty,
  emptyHref,
  children,
}: {
  title: string;
  hint: string;
  total: string;
  empty: boolean;
  emptyHref: string;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <header className="flex items-end justify-between gap-3 px-1">
        <div className="flex min-w-0 flex-col">
          <h2 className="text-headline-semibold text-text-primary">{title}</h2>
          <p className="text-body-2-regular text-text-tertiary">{hint}</p>
        </div>
        <span className="shrink-0 text-body-semibold text-text-primary tabular-nums">{total}</span>
      </header>
      {empty ? (
        <Card>
          <EmptyState>
            No {title} pockets yet.{" "}
            <Link href={emptyHref} className="text-button-ghost-foreground hover:underline">
              Add a {title} category
            </Link>
            .
          </EmptyState>
        </Card>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</ul>
      )}
    </section>
  );
}

function PocketLink({ href, category, children }: { href: string; category: Category; children: ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className={cx(
          "flex h-full flex-col gap-3 rounded-3xl border border-separator-border bg-background-primary-default p-3 outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring sm:p-4",
          category.archived && "opacity-60",
        )}
      >
        <div className="flex items-center gap-3">
          <CategoryIcon name={category.name} emoji={category.emoji} color={category.color} group={category.group} />
          <span className="min-w-0 flex-1 truncate text-headline-semibold text-text-primary">{category.name}</span>
          <RiArrowRightSLine className="size-5 shrink-0 text-foreground-icon-tertiary rtl:-scale-x-100" aria-hidden />
        </div>
        {children}
      </Link>
    </li>
  );
}

function SpendingCard({ line, href, fmt, signed }: { line: BudgetLine; href: string; fmt: (n: number) => string; signed: (n: number) => string }) {
  // The bar shows real spending; budget sent to savings or other pockets is named, not counted as spent.
  const usage = line.available > 0 ? line.spent / line.available : line.spent > 0 ? 2 : 0;
  const extra = line.carried + line.adjusted;
  const moved = line.actual - line.spent - line.toSavings;
  return (
    <PocketLink href={href} category={line.category}>
      <div className="flex flex-col">
        <span className={cx("text-title-2-medium tabular-nums", line.remaining < 0 ? "text-text-negative" : "text-text-primary")}>
          {fmt(Math.abs(line.remaining))}
        </span>
        <span className="text-body-2-regular text-text-tertiary">{line.remaining < 0 ? "over" : "left"} this period</span>
      </div>
      <div className="flex flex-col gap-1.5">
        <Meter aria-label={`${line.category.name} used this period`} value={Math.min(usage, 1) * 100} tone={usageTone(usage)} size="sm" />
        <span className="text-caption-1-medium text-text-tertiary tabular-nums">
          {fmt(line.spent)} spent of {fmt(line.available)}
          {line.toSavings ? ` · ${fmt(line.toSavings)} to savings` : ""}
          {moved ? ` · ${signed(-moved)} moved` : ""}
          {extra ? ` · ${signed(extra)} carried` : ""}
        </span>
      </div>
    </PocketLink>
  );
}
