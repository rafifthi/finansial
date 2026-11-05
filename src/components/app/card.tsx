import Link from "next/link";
import type { ReactNode } from "react";
import { cx } from "@/utils/cx";

export function Card({
  id,
  title,
  description,
  action,
  href,
  className,
  children,
}: {
  /** Anchor target; scroll-margin keeps it clear of the sticky phone header. */
  id?: string;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  /** Shows a "View all" link in the header. */
  href?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={cx(
        "flex min-w-0 scroll-mt-20 flex-col gap-4 rounded-3xl border border-separator-border bg-background-primary-default p-4 sm:p-5",
        className,
      )}
    >
      {title || action || href ? (
        <header className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title ? <h2 className="text-headline-semibold text-text-primary">{title}</h2> : null}
            {description ? <p className="text-body-2-regular text-text-tertiary">{description}</p> : null}
          </div>
          {action}
          {href ? (
            <Link
              href={href}
              className="shrink-0 rounded-md text-body-2-medium text-button-ghost-foreground outline-none hover:underline focus-visible:ring-2 focus-visible:ring-border-focus-ring"
            >
              View all
            </Link>
          ) : null}
        </header>
      ) : null}
      {children}
    </section>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <p className="py-6 text-center text-body-2-regular text-text-tertiary">{children}</p>;
}
