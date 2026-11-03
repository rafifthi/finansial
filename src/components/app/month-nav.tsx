import Link from "next/link";
import { RiArrowLeftSLine, RiArrowRightSLine } from "@remixicon/react";
import { addMonths } from "@/lib/finance/dates";
import { END_OF_MONTH, periodRange } from "@/lib/finance/period";
import { cx } from "@/utils/cx";
import { monthLabelClient as monthLabel, shortDateClient as shortDate } from "./format";

export { monthLabel, shortDate };

/** "25 Oct – 24 Nov" for a budget period, or null for plain calendar months. */
export function periodLabel(period: string, cutoff: number) {
  if (cutoff === END_OF_MONTH) return null;
  const { start, end } = periodRange(period, cutoff);
  return `${shortDate(start)} – ${shortDate(end)}`;
}

/** ‹ October 2026 › — keeps the other query params when switching periods. */
export function MonthNav({
  month,
  path,
  params = {},
  cutoff = END_OF_MONTH,
}: {
  month: string;
  path: string;
  params?: Record<string, string | string[] | undefined>;
  /** Budget cut-off day; shows the period's date range when it isn't month end. */
  cutoff?: number;
}) {
  const range = periodLabel(month, cutoff);
  const href = (m: string) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (typeof v === "string" && v && k !== "m") q.set(k, v);
    q.set("m", m);
    return `${path}?${q}`;
  };
  const btn = cx(
    "flex size-9 items-center justify-center rounded-2lg border border-border-button-default bg-background-primary-default shadow-xs",
    "text-foreground-icon-primary outline-none hover:bg-background-primary-hover focus-visible:ring-2 focus-visible:ring-border-focus-ring",
  );
  return (
    <div className="flex w-full items-center justify-between gap-2 sm:w-auto sm:justify-start">
      <Link href={href(addMonths(month, -1))} className={btn} aria-label="Previous month">
        <RiArrowLeftSLine className="size-5 rtl:-scale-x-100" aria-hidden />
      </Link>
      <span className="flex min-w-36 flex-col items-center text-center">
        <span className="text-headline-medium text-text-primary tabular-nums">{monthLabel(month)}</span>
        {range ? <span className="text-caption-1-medium text-text-tertiary tabular-nums">{range}</span> : null}
      </span>
      <Link href={href(addMonths(month, 1))} className={btn} aria-label="Next month">
        <RiArrowRightSLine className="size-5 rtl:-scale-x-100" aria-hidden />
      </Link>
    </div>
  );
}
