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

const TONE_BG: Record<StatTone, string> = {
  blue: "from-blue-500 to-blue-600",
  orange: "from-orange-400 to-orange-500",
  purple: "from-purple-500 to-purple-600",
  pink: "from-pink-500 to-pink-600",
  sky: "from-sky-400 to-sky-500",
  emerald: "from-emerald-500 to-emerald-600",
};

const DELTA_TEXT = { lime: "text-status-lime-text", rose: "text-status-rose-text", neutral: "text-text-tertiary" } as const;

/**
 * Server-friendly wrapper: icons are resolved here because components can't
 * cross the RSC boundary. Phones get a compact two-up grid; larger screens the
 * BoardUI footer cards.
 */
export function DashboardStats({ stats }: { stats: DashboardStat[] }) {
  return (
    <>
      <div className="grid grid-cols-2 gap-2.5 sm:hidden">
        {stats.map(({ key, label, value, delta, deltaColor, caption, tone }) => {
          const Icon = ICONS[key];
          return (
            <section key={key} className="glass glass-secondary flex min-w-0 flex-col gap-2 rounded-2xl bg-background-secondary-default p-3">
              <div className="flex items-center justify-between gap-2">
                <span className={cx("flex size-7 items-center justify-center rounded-lg bg-linear-to-b", TONE_BG[tone])}>
                  <Icon className="size-4 text-white" aria-hidden />
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
      <StatCards variant="footer" columns={2} className="glass-cards hidden sm:grid 2xl:grid-cols-4" stats={stats.map(({ key, ...s }) => ({ ...s, icon: ICONS[key] }))} />
    </>
  );
}
