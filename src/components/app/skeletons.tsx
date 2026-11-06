import type { ReactNode } from "react";
import { Skeleton } from "@/components/base/skeleton/skeleton";
import { cx } from "@/utils/cx";

/**
 * Route loading states (loading.tsx): placeholders in the shape of each page,
 * built from the same shells as Card and PageHeader so nothing jumps when the
 * real content streams in. The app shell (sidebar, tab bar) stays put.
 */

/** The page's loading region: announced once, hidden blocks inside. */
export function PageSkeleton({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div aria-busy="true" className="contents">
      <span role="status" className="sr-only">
        Loading {label}…
      </span>
      {children}
    </div>
  );
}

/** Title, description and action buttons, laid out like PageHeader. */
export function HeaderSkeleton({ actions = 1, wide = false }: { actions?: number; wide?: boolean }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="flex min-w-0 flex-col gap-2 py-0.5">
        <Skeleton shape="text" className="h-7 w-40" />
        <Skeleton shape="text" className={cx("h-4 max-w-full", wide ? "w-96" : "w-64")} />
      </div>
      {actions > 0 ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: actions }, (_, i) => (
            <Skeleton key={i} className="h-9 w-28" />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** A Card shell with an optional title line. */
export function CardSkeleton({ title = true, className, children }: { title?: boolean; className?: string; children?: ReactNode }) {
  return (
    <div className={cx("flex min-w-0 flex-col gap-4 rounded-3xl border border-separator-border bg-background-primary-default p-3 sm:p-4", className)}>
      {title ? (
        <div className="flex flex-col gap-1.5">
          <Skeleton shape="text" className="h-4.5 w-36" />
          <Skeleton shape="text" className="h-3.5 w-52 max-w-full" />
        </div>
      ) : null}
      {children}
    </div>
  );
}

/** Label-over-figure tiles, as in the dashboard and Savings summaries. */
export function StatsSkeleton({ count = 3, className }: { count?: number; className?: string }) {
  return (
    <div className={cx("grid gap-4", count >= 4 ? "grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-3", className)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <Skeleton shape="text" className="h-3.5 w-24" />
          <Skeleton shape="text" className="h-6 w-36 max-w-full" />
        </div>
      ))}
    </div>
  );
}

/** List rows: a tile, two lines of text and an amount on the end. */
export function RowsSkeleton({ rows = 6, tile = "circle" }: { rows?: number; tile?: "circle" | "rect" | "none" }) {
  return (
    <div className="flex flex-col divide-y divide-separator-border">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 py-3">
          {tile === "none" ? null : <Skeleton shape={tile} className={tile === "circle" ? "size-10 shrink-0" : "size-7 shrink-0 rounded-lg"} />}
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {/* Varied widths read as text rather than a grid of bars. */}
            <Skeleton shape="text" className={cx("h-4", ["w-40", "w-28", "w-48", "w-32"][i % 4])} />
            <Skeleton shape="text" className={cx("h-3", ["w-24", "w-32", "w-20", "w-28"][i % 4])} />
          </div>
          <Skeleton shape="text" className="h-4 w-20 shrink-0" />
        </div>
      ))}
    </div>
  );
}

/** A chart's plot area. */
export function ChartSkeleton({ className }: { className?: string }) {
  return <Skeleton className={cx("h-56 w-full", className)} />;
}

/** Name-and-bar lines, as in budget usage and savings targets. */
export function MetersSkeleton({ count = 4, columns = "md:grid-cols-2" }: { count?: number; columns?: string }) {
  return (
    <div className={cx("grid gap-x-8 gap-y-5", columns)}>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex flex-col gap-2">
          <div className="flex justify-between gap-3">
            <Skeleton shape="text" className={cx("h-4", ["w-24", "w-32", "w-20", "w-28"][i % 4])} />
            <Skeleton shape="text" className="h-3.5 w-24" />
          </div>
          <Skeleton shape="text" className="h-1.5 w-full rounded-full" />
        </div>
      ))}
    </div>
  );
}
