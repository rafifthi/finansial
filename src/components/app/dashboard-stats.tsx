"use client";

import { RiArrowDownCircleLine, RiArrowUpCircleLine, RiPieChartLine, RiSafe2Line } from "@remixicon/react";
import { StatCards, type Stat, type StatTone } from "@/components/application/dashboard/stat-cards";
import { cx } from "@/utils/cx";

const ICONS = {
  income: RiArrowDownCircleLine,
  spent: RiArrowUpCircleLine,
  saved: RiSafe2Line,
  unallocated: RiPieChartLine,
};

export interface DashboardStat {
  key: keyof typeof ICONS;
  label: string;
  value: string;
  delta: string;
  deltaColor: Stat["deltaColor"];
  caption: string;
  hint?: string;
  tone: StatTone;
}

const DELTA_TEXT = { lime: "text-text-positive", rose: "text-text-negative", neutral: "text-text-secondary" } as const;

/**
 * Server-friendly wrapper: icons are resolved here because components can't
 * cross the RSC boundary. Phones get a compact two-up grid; larger screens the
 * BoardUI footer cards.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {stats.map(({ key, label, value, delta, deltaColor, caption }) => {
          const Icon = ICONS[key];
          return (
            <section key={key} className="flex min-w-0 flex-col gap-2 rounded-3xl border border-separator-border bg-background-primary-default p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="flex size-8 items-center justify-center rounded-full bg-background-secondary-default">
                  <Icon className="size-4 text-foreground-icon-primary" aria-hidden />
                </span>
                <span className={cx("text-caption-1-semibold tabular-nums", DELTA_TEXT[deltaColor])}>{delta}</span>
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="text-body-2-medium text-text-secondary">{label}</span>
                <span className="truncate text-headline-semibold text-text-primary tabular-nums">{value}</span>
                <span className="truncate text-caption-1-medium text-text-tertiary">{caption}</span>
              </div>
            </section>
          );
        })}
      </div>
      <StatCards variant="footer" columns={2} className="hidden sm:grid 2xl:grid-cols-4" stats={stats.map(({ key, ...s }) => ({ ...s, icon: ICONS[key] }))} />
    </>
  );
}
